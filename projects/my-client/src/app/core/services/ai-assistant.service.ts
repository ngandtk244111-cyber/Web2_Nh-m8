import { Injectable, signal, inject, computed, effect, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { DesignBrief } from '../models/custom-request.model';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { MascotService } from './mascot.service';
import { ChatPanelService } from './chat-panel.service';
import { AuthService } from './auth.service';

/** Sản phẩm thật server đã dò lại từ gợi ý của AI (slug -> tên -> từ khoá -> nổi bật). */
export interface AiSuggestedProduct {
  id: string;
  name: string;
  slug: string;
  image: string;
  price: number;
  originalPrice?: number | null;
}

export interface AiChatMessage {
  id: string;
  sender: 'USER' | 'AI';
  text: string;
  time: string;
  quickReplies?: string[];
  suggestedProducts?: AiSuggestedProduct[];
  /** Tin báo lỗi kết nối AI — hiện thẻ lỗi kèm nút Gửi lại, không gửi vào lịch sử cho AI. */
  error?: boolean;
}

export interface AiConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

interface AiConversation extends AiConversationSummary {
  messages: AiChatMessage[];
  brief: DesignBrief | null;
  conceptImage: string | null;
}

interface AiAssistantResponse {
  success: boolean;
  reply: string;
  quickReplies: string[];
  brief: Partial<DesignBrief> | null;
  products: AiSuggestedProduct[];
  error?: string;
}

const BASE = `${environment.apiUrl}/ai`;
const CONV_BASE = `${BASE}/conversations`;
const WELCOME_ID = 'ai-init';
/** Khách chưa đăng nhập: lưu hội thoại ở trình duyệt. Đã đăng nhập: lưu MongoDB (AiConversation). */
const GUEST_STORAGE_KEY = 'lumea_ai_conversations';
const ACTIVE_STORAGE_KEY = 'lumea_ai_active_conversation';
const GUEST_LIMIT = 20;
const ERROR_TEXT = 'Xin lỗi, mình đang gặp sự cố kết nối AI. Bạn bấm "Gửi lại" hoặc thử lại sau ít phút nhé.';
/** Hiệu ứng chữ hiện dần: mỗi nhịp hiện thêm vài ký tự, câu dài cũng xong trong khoảng ~2 giây. */
const TYPING_TICK_MS = 20;
const TYPING_TOTAL_TICKS = 100;

@Injectable({
  providedIn: 'root'
})
export class AiAssistantService {
  private http = inject(HttpClient);
  private mascotService = inject(MascotService);
  private chatPanel = inject(ChatPanelService);
  private authService = inject(AuthService);
  private router = inject(Router);

  readonly isOpen = computed(() => this.chatPanel.active() === 'ai');
  readonly isLoggedIn = computed(() => !!this.authService.currentUser());
  private readonly sessionId = `goh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  private conversationId = this.newId('conv');

  // Conversation history — tin nhắn chào ban đầu tạo qua hàm dùng chung với newChat().
  private messagesSignal = signal<AiChatMessage[]>([this.buildWelcomeMessage()]);
  readonly messages = this.messagesSignal.asReadonly();

  private conversationsSignal = signal<AiConversationSummary[]>([]);
  readonly conversations = this.conversationsSignal.asReadonly();
  readonly activeConversationId = signal(this.conversationId);

  // Generated Design Brief — cập nhật dần từ các trường AI trả về mỗi lượt chat.
  private currentBriefSignal = signal<DesignBrief | null>(null);
  readonly currentBrief = this.currentBriefSignal.asReadonly();

  // Generated Concept Image — vẫn là ảnh minh họa tĩnh chọn theo từ khóa (chưa có model sinh ảnh thật).
  private conceptImageSignal = signal<string | null>(null);
  readonly conceptImage = this.conceptImageSignal.asReadonly();

  private isThinkingSignal = signal<boolean>(false);
  readonly isThinking = this.isThinkingSignal.asReadonly();

  /** Tin AI đang "gõ": id tin + số ký tự đã hiện. */
  private typingSignal = signal<{ id: string; shown: number } | null>(null);
  readonly typingId = computed(() => this.typingSignal()?.id ?? null);

  /** Đang chờ AI hoặc đang hiện chữ — khoá gửi tin mới, hiện nút Dừng. */
  readonly isBusy = computed(() => this.isThinkingSignal() || this.typingSignal() !== null);

  private pending: Subscription | null = null;
  private typingTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Đổi tài khoản (đăng nhập/đăng xuất) -> nạp lại danh sách hội thoại của đúng người đó.
    effect(() => {
      const userId = this.authService.currentUser()?._id ?? null;
      untracked(() => this.onUserChanged(userId));
    });
  }

  openModal(): void {
    this.chatPanel.open('ai');
  }

  closeModal(): void {
    this.chatPanel.close('ai');
  }

  // ===================== Gửi / dừng / thử lại / sửa =====================

  sendMessage(userText: string): void {
    const text = userText.trim();
    if (!text || this.isBusy()) return;

    const history = this.historyFor(this.messagesSignal());
    this.messagesSignal.update(msgs => [...msgs, this.buildMessage('USER', text)]);
    this.request(text, history);
  }

  /** Dừng giống nút Stop của Chatbox: huỷ request đang chờ, hoặc hiện nốt câu trả lời đang gõ. */
  stop(): void {
    if (this.pending) {
      this.pending.unsubscribe();
      this.pending = null;
      this.isThinkingSignal.set(false);
      this.mascotService.stopThinking('idle');
      this.persist();
    }
    if (this.typingSignal()) this.finishTyping();
  }

  /** Tạo lại câu trả lời cho tin cuối của khách (dùng cho nút "Thử lại" và "Gửi lại" khi lỗi). */
  regenerate(): void {
    if (this.isBusy()) return;
    const msgs = this.messagesSignal();
    const lastUserIdx = this.lastIndexOf(msgs, m => m.sender === 'USER');
    if (lastUserIdx === -1) return;

    const kept = msgs.slice(0, lastUserIdx + 1);
    this.messagesSignal.set(kept);
    this.request(kept[lastUserIdx].text, this.historyFor(kept.slice(0, lastUserIdx)));
  }

  /** Sửa 1 tin của khách: bỏ mọi tin từ tin đó trở đi rồi gửi lại nội dung mới. */
  editMessage(messageId: string, newText: string): void {
    const text = newText.trim();
    if (!text || this.isBusy()) return;
    const msgs = this.messagesSignal();
    const idx = msgs.findIndex(m => m.id === messageId && m.sender === 'USER');
    if (idx === -1) return;

    const before = msgs.slice(0, idx);
    this.messagesSignal.set([...before, this.buildMessage('USER', text)]);
    this.request(text, this.historyFor(before));
  }

  private request(userText: string, history: { sender: 'USER' | 'AI'; text: string }[]): void {
    this.isThinkingSignal.set(true);
    this.mascotService.startThinking();

    this.pending = this.http.post<AiAssistantResponse>(`${BASE}/assistant`, {
      userText,
      history,
      currentBrief: this.currentBriefSignal(),
      sessionId: this.sessionId,
    }).subscribe({
      next: (res) => {
        this.pending = null;
        if (res.success === false) this.applyError();
        else this.applyResponse(res);
      },
      error: () => {
        this.pending = null;
        this.applyError();
      },
    });
  }

  private applyResponse(res: AiAssistantResponse): void {
    if (res.brief) {
      const prev = this.currentBriefSignal();
      const merged: DesignBrief = {
        productType: res.brief.productType || prev?.productType || 'Đồ decor in 3D',
        theme: res.brief.theme || prev?.theme || '',
        style: res.brief.style || prev?.style || '',
        color: res.brief.color || prev?.color || '',
        size: res.brief.size || prev?.size || '',
        usage: res.brief.usage || prev?.usage || '',
        customText: res.brief.customText ?? prev?.customText,
        notes: res.brief.notes || prev?.notes,
      };
      this.currentBriefSignal.set(merged);
      if (!this.conceptImageSignal()) {
        this.conceptImageSignal.set(this.pickConceptImage(merged));
      }
    }

    const aiMsg: AiChatMessage = {
      ...this.buildMessage('AI', res.reply),
      quickReplies: res.quickReplies,
      suggestedProducts: res.products ?? [],
    };
    this.messagesSignal.update(msgs => [...msgs, aiMsg]);
    this.isThinkingSignal.set(false);
    this.startTyping(aiMsg);

    if (res.brief) {
      // AI vừa đưa ra gợi ý/brief decor cụ thể — biểu cảm tự tin thay vì cười thường.
      this.mascotService.stopThinking('confident');
    } else {
      this.mascotService.stopThinking('happy');
    }
  }

  private applyError(): void {
    this.messagesSignal.update(msgs => [...msgs, { ...this.buildMessage('AI', ERROR_TEXT), error: true }]);
    this.isThinkingSignal.set(false);
    this.mascotService.stopThinking('sad');
    this.persist();
  }

  // ===================== Hiệu ứng chữ hiện dần =====================

  /** Nội dung đang hiển thị của 1 tin — cắt ngắn nếu tin đó đang được "gõ". */
  displayText(msg: AiChatMessage): string {
    const typing = this.typingSignal();
    return typing && typing.id === msg.id ? msg.text.slice(0, typing.shown) : msg.text;
  }

  private startTyping(msg: AiChatMessage): void {
    this.clearTypingTimer();
    const step = Math.max(1, Math.ceil(msg.text.length / TYPING_TOTAL_TICKS));
    this.typingSignal.set({ id: msg.id, shown: 0 });
    this.typingTimer = setInterval(() => {
      const t = this.typingSignal();
      if (!t) return this.clearTypingTimer();
      const shown = t.shown + step;
      if (shown >= msg.text.length) this.finishTyping();
      else this.typingSignal.set({ id: t.id, shown });
    }, TYPING_TICK_MS);
  }

  private finishTyping(): void {
    this.clearTypingTimer();
    this.typingSignal.set(null);
    this.persist();
  }

  private clearTypingTimer(): void {
    if (this.typingTimer) clearInterval(this.typingTimer);
    this.typingTimer = null;
  }

  // ===================== Lịch sử hội thoại =====================

  /** Bắt đầu cuộc trò chuyện mới (nút "Làm mới"/"Cuộc trò chuyện mới"). Cuộc cũ vẫn nằm trong lịch sử. */
  newChat(): void {
    this.stop();
    this.conversationId = this.newId('conv');
    this.activeConversationId.set(this.conversationId);
    this.currentBriefSignal.set(null);
    this.conceptImageSignal.set(null);
    this.messagesSignal.set([this.buildWelcomeMessage()]);
    this.saveActiveId(null);
  }

  /** Giữ tên cũ cho các chỗ đang gọi. */
  resetChat(): void {
    this.newChat();
  }

  openConversation(id: string): void {
    if (id === this.conversationId) return;
    this.stop();
    const userId = this.authService.currentUser()?._id;
    if (userId) {
      this.http.get<{ success: boolean; conversation: AiConversation }>(`${CONV_BASE}/${id}`, { params: { userId } }).subscribe({
        next: (res) => res.success && this.applyConversation(res.conversation),
        error: () => this.loadConversations(), // không còn trên server -> làm mới danh sách
      });
    } else {
      const conv = this.readGuestConversations().find(c => c.id === id);
      if (conv) this.applyConversation(conv);
    }
  }

  deleteConversation(id: string): void {
    const userId = this.authService.currentUser()?._id;
    this.conversationsSignal.update(list => list.filter(c => c.id !== id));
    if (userId) {
      this.http.delete(`${CONV_BASE}/${id}`, { params: { userId } }).subscribe({ error: () => this.loadConversations() });
    } else {
      this.writeGuestConversations(this.readGuestConversations().filter(c => c.id !== id));
    }
    if (id === this.conversationId) this.newChat();
  }

  loadConversations(): void {
    const userId = this.authService.currentUser()?._id;
    if (!userId) {
      this.conversationsSignal.set(this.readGuestConversations().map(({ id, title, updatedAt }) => ({ id, title, updatedAt })));
      return;
    }
    this.http.get<{ success: boolean; conversations: AiConversationSummary[] }>(CONV_BASE, { params: { userId } }).subscribe({
      next: (res) => res.success && this.conversationsSignal.set(res.conversations),
      error: () => { /* giữ danh sách cũ */ },
    });
  }

  private onUserChanged(userId: string | null): void {
    // Tải lại trang: mở lại cuộc trò chuyện đang dở của đúng tài khoản/khách này (đọc trước khi newChat() xoá).
    const active = this.readActiveId();
    this.newChat();
    this.loadConversations();
    if (active && active.owner === (userId ?? 'guest')) this.openConversation(active.id);
  }

  private applyConversation(conv: AiConversation): void {
    this.conversationId = conv.id;
    this.activeConversationId.set(conv.id);
    this.messagesSignal.set(conv.messages?.length ? conv.messages : [this.buildWelcomeMessage()]);
    this.currentBriefSignal.set(conv.brief ?? null);
    this.conceptImageSignal.set(conv.conceptImage ?? null);
    this.saveActiveId(conv.id);
  }

  /** Lưu cuộc trò chuyện hiện tại (chỉ khi khách đã gửi ít nhất 1 tin). */
  private persist(): void {
    const messages = this.messagesSignal();
    const firstUser = messages.find(m => m.sender === 'USER');
    if (!firstUser) return;

    const summary: AiConversationSummary = {
      id: this.conversationId,
      title: firstUser.text.length > 60 ? firstUser.text.slice(0, 57) + '...' : firstUser.text,
      updatedAt: new Date().toISOString(),
    };
    this.conversationsSignal.update(list => [summary, ...list.filter(c => c.id !== summary.id)]);
    this.saveActiveId(summary.id);

    const userId = this.authService.currentUser()?._id;
    if (userId) {
      this.http.put(`${CONV_BASE}/${summary.id}`, {
        userId,
        title: summary.title,
        messages,
        brief: this.currentBriefSignal(),
        conceptImage: this.conceptImageSignal(),
      }).subscribe({ error: () => { /* lưu lỗi thì lượt sau lưu lại cả hội thoại */ } });
    } else {
      const conv: AiConversation = {
        ...summary,
        messages,
        brief: this.currentBriefSignal(),
        conceptImage: this.conceptImageSignal(),
      };
      this.writeGuestConversations([conv, ...this.readGuestConversations().filter(c => c.id !== conv.id)]);
    }
  }

  private readGuestConversations(): AiConversation[] {
    try {
      const raw = localStorage.getItem(GUEST_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private writeGuestConversations(list: AiConversation[]): void {
    try {
      localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(list.slice(0, GUEST_LIMIT)));
    } catch { /* hết dung lượng / chặn storage — bỏ qua */ }
  }

  private readActiveId(): { id: string; owner: string } | null {
    try {
      const raw = localStorage.getItem(ACTIVE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  private saveActiveId(id: string | null): void {
    try {
      if (!id) localStorage.removeItem(ACTIVE_STORAGE_KEY);
      else localStorage.setItem(ACTIVE_STORAGE_KEY, JSON.stringify({ id, owner: this.authService.currentUser()?._id ?? 'guest' }));
    } catch { /* ignore */ }
  }

  // ===================== Design Brief =====================

  private pickConceptImage(brief: DesignBrief): string {
    const text = `${brief.productType} ${brief.theme}`.toLowerCase();
    if (text.includes('đèn') || text.includes('mèo') || text.includes('cat')) {
      return 'https://images.unsplash.com/photo-1574158622682-e40e69881006?auto=format&fit=crop&w=700&q=80';
    }
    if (text.includes('bình') || text.includes('hoa') || text.includes('vase')) {
      return 'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?auto=format&fit=crop&w=700&q=80';
    }
    if (text.includes('khay') || text.includes('bút') || text.includes('organizer')) {
      return 'https://images.unsplash.com/photo-1585776245991-cf89dd7fc73a?auto=format&fit=crop&w=700&q=80';
    }
    return 'https://images.unsplash.com/photo-1544457070-4cd773b4d71e?auto=format&fit=crop&w=700&q=80';
  }

  regenerateConcept(): void {
    this.isThinkingSignal.set(true);
    this.mascotService.startThinking();
    setTimeout(() => {
      const alt = 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=700&q=80';
      this.conceptImageSignal.set(alt);
      this.isThinkingSignal.set(false);
      this.mascotService.stopThinking('confident');
      this.persist();
    }, 500);
  }

  useThisIdea(): void {
    const brief = this.currentBriefSignal();
    const concept = this.conceptImageSignal();
    if (!brief) return;

    this.closeModal();

    this.router.navigate(['/custom-request/new'], {
      queryParams: {
        fromAi: 'true',
      },
      state: {
        brief,
        aiConceptImage: concept,
      }
    });
  }

  // ===================== Helpers =====================

  /** Lịch sử gửi cho AI: bỏ lời chào mặc định và các tin báo lỗi. */
  private historyFor(msgs: AiChatMessage[]): { sender: 'USER' | 'AI'; text: string }[] {
    return msgs
      .filter(m => m.id !== WELCOME_ID && !m.error)
      .map(m => ({ sender: m.sender, text: m.text }));
  }

  private lastIndexOf(msgs: AiChatMessage[], pred: (m: AiChatMessage) => boolean): number {
    for (let i = msgs.length - 1; i >= 0; i--) if (pred(msgs[i])) return i;
    return -1;
  }

  private buildMessage(sender: 'USER' | 'AI', text: string): AiChatMessage {
    return { id: this.newId('msg'), sender, text, time: this.now() };
  }

  private newId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private buildWelcomeMessage(): AiChatMessage {
    return {
      id: WELCOME_ID,
      sender: 'AI',
      text: 'Chào bạn! Mình là AI Idea Assistant của Luméa ✨. Bạn đang có ý tưởng đồ decor hay nội thất in 3D nào trong đầu, hay muốn mình gợi ý sản phẩm có sẵn trong shop? Cứ mô tả tự nhiên cho mình nghe nhé.',
      time: 'Vừa xong',
      quickReplies: [
        'Đèn ngủ mini hình mèo dễ thương',
        'Bình hoa hình học phong cách Japandi',
        'Có bình hoa nào dưới 300k không?',
        'Khay đựng phụ kiện bàn làm việc',
      ]
    };
  }

  private now(): string {
    return new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }
}
