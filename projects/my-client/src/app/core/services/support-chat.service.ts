import { Injectable, computed, inject, signal, effect, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { io, Socket } from 'socket.io-client';
import { AuthService } from './auth.service';
import { ChatPanelService } from './chat-panel.service';
import { ToastService } from './toast.service';
import { environment } from '../../../environments/environment';

export interface ChatMessage {
  _id?: string;
  sessionId: string;
  sender: 'customer' | 'staff';
  text: string;
  createdAt?: string;
  /** Tin do trợ lý tự động gửi. */
  auto?: boolean;
  /** Nút dẫn tới trang liên quan (đường dẫn nội bộ, VD '/orders/track'). */
  links?: { label: string; url: string }[];
}

const SESSION_KEY = 'deco3d_chat_session';
/** Thời điểm khách xem khung chat lần cuối — tin nhân viên gửi sau mốc này tính là chưa đọc. */
const LAST_READ_KEY = 'deco3d_chat_last_read';

@Injectable({ providedIn: 'root' })
export class SupportChatService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private chatPanel = inject(ChatPanelService);
  private toast = inject(ToastService);

  private socket: Socket | null = null;
  private historyLoaded = false;
  readonly messages = signal<ChatMessage[]>([]);
  readonly isOpen = computed(() => this.chatPanel.active() === 'support');
  readonly sessionId: string;

  /** Có nhân viên đang mở trang quản trị (phòng "staff" của socket) — chấm xanh trên khung chat. */
  readonly staffOnline = signal(false);
  /** Nhân viên đang gõ trả lời — hiện bong bóng ba chấm. */
  readonly staffTyping = signal(false);

  /** Số tin nhân viên gửi tới trong lúc khung chat đang đóng — hiện trên nút chat nổi. */
  readonly unreadCount = signal(0);

  private typingSent = false;
  private typingStopTimer: ReturnType<typeof setTimeout> | null = null;
  private staffTypingTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.sessionId = this.loadOrCreateSessionId();
    // Khung chat có thể được mở tự động sau khi đăng nhập (ChatPanelService) -> kết nối khi khung mở.
    // Mở khung = đã đọc hết tin.
    effect(() => {
      if (this.isOpen()) untracked(() => {
        this.ensureConnected();
        this.markRead();
      });
    });
    // Khách đã đăng nhập thì kết nối sẵn (chat chỉ dành cho khách đăng nhập), để vẫn nhận tin
    // nhân viên trả lời khi khung đang đóng và báo số tin chưa đọc trên nút chat.
    effect(() => {
      if (this.authService.currentUser()) untracked(() => this.ensureConnected());
    });
  }

  /** Chưa có mốc (máy mới / trước khi có tính năng) -> lấy mốc là bây giờ, không báo dồn tin cũ. */
  private readLastRead(): number {
    try {
      const saved = Number(localStorage.getItem(LAST_READ_KEY));
      if (saved) return saved;
      localStorage.setItem(LAST_READ_KEY, String(Date.now()));
    } catch { /* localStorage bị chặn: coi như đã đọc hết */ }
    return Date.now();
  }

  private markRead(): void {
    this.unreadCount.set(0);
    try {
      localStorage.setItem(LAST_READ_KEY, String(Date.now()));
    } catch { /* bỏ qua: chỉ mất số chưa đọc khi tải lại trang */ }
  }

  private loadOrCreateSessionId(): string {
    try {
      let id = localStorage.getItem(SESSION_KEY);
      if (!id) {
        id = 'sess-' + Date.now() + '-' + Math.floor(Math.random() * 100000);
        localStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch {
      return 'sess-' + Date.now();
    }
  }

  private ensureConnected(): void {
    if (this.socket) return;

    this.socket = io(environment.socketUrl);
    this.socket.on('connect', () => {
      this.socket?.emit('chat:join', this.sessionId);
    });
    this.socket.on('disconnect', () => this.staffOnline.set(false));
    this.socket.on('chat:message', (message: ChatMessage) => {
      if (message.sender === 'staff') this.setStaffTyping(false);
      const isNew = !message._id || !this.messages().some(m => m._id === message._id);
      this.appendMessage(message);
      if (message.sender !== 'staff' || !isNew) return;
      if (this.isOpen()) {
        this.markRead();
      } else {
        this.unreadCount.update(n => n + 1);
        // Tin tự động chỉ là trả lời tức thì cho câu khách vừa gửi -> không cần báo riêng.
        if (!message.auto) this.toast.info('Luméa vừa trả lời bạn trong khung chat hỗ trợ.');
      }
    });
    this.socket.on('chat:staff-status', ({ online }: { online: boolean }) => {
      this.staffOnline.set(!!online);
      if (!online) this.setStaffTyping(false);
    });
    this.socket.on('chat:typing', ({ typing }: { typing: boolean }) => this.setStaffTyping(!!typing));
    this.loadHistory();
  }

  /** Tự tắt ba chấm sau 6s nếu không nhận được tín hiệu dừng (mất mạng giữa chừng...). */
  private setStaffTyping(typing: boolean): void {
    if (this.staffTypingTimer) clearTimeout(this.staffTypingTimer);
    this.staffTypingTimer = typing ? setTimeout(() => this.staffTyping.set(false), 6000) : null;
    this.staffTyping.set(typing);
  }

  /** Gọi mỗi khi khách gõ: báo "đang gõ" 1 lần, tự báo dừng sau 2.5s không gõ thêm. */
  notifyTyping(): void {
    if (!this.socket) return;
    if (!this.typingSent) {
      this.typingSent = true;
      this.socket.emit('chat:typing', { sessionId: this.sessionId, typing: true });
    }
    if (this.typingStopTimer) clearTimeout(this.typingStopTimer);
    this.typingStopTimer = setTimeout(() => this.stopTyping(), 2500);
  }

  private stopTyping(): void {
    if (this.typingStopTimer) clearTimeout(this.typingStopTimer);
    this.typingStopTimer = null;
    if (!this.typingSent) return;
    this.typingSent = false;
    this.socket?.emit('chat:typing', { sessionId: this.sessionId, typing: false });
  }

  /** Nạp lại tin cũ (kể cả câu trả lời nhân viên gửi khi khách đã đóng trang). */
  private loadHistory(): void {
    if (this.historyLoaded) return;
    this.historyLoaded = true;
    this.http.get<{ success: boolean; messages: ChatMessage[] }>(`${environment.apiUrl}/chat/${this.sessionId}/messages`).subscribe({
      next: (res) => {
        if (!res.success) return;
        // Gộp với tin vừa nhận qua socket trong lúc chờ HTTP, bỏ trùng theo _id.
        const seen = new Set(res.messages.map(m => m._id));
        this.messages.update(live => [...res.messages, ...live.filter(m => !m._id || !seen.has(m._id))]);
        // Nhân viên trả lời lúc khách đã rời trang -> lần sau vào vẫn thấy số tin chưa đọc.
        if (this.isOpen()) {
          this.markRead();
        } else {
          const lastRead = this.readLastRead();
          this.unreadCount.set(res.messages.filter(m =>
            m.sender === 'staff' && !m.auto && m.createdAt && new Date(m.createdAt).getTime() > lastRead).length);
        }
      },
      error: () => { this.historyLoaded = false; },
    });
  }

  private appendMessage(message: ChatMessage): void {
    this.messages.update(list => (message._id && list.some(m => m._id === message._id) ? list : [...list, message]));
  }

  /** Chưa đăng nhập thì ChatPanelService mở popup đăng nhập thay vì mở khung chat. */
  open(): void {
    this.chatPanel.open('support');
  }

  close(): void {
    this.stopTyping();
    this.chatPanel.close('support');
  }

  sendMessage(text: string): void {
    if (!text.trim()) return;
    this.ensureConnected();
    this.stopTyping();
    // Khách đã đăng nhập thì gửi kèm tên/SĐT để nhân viên biết đang nói chuyện với ai.
    const user = this.authService.currentUser();
    this.socket?.emit('chat:message', {
      sessionId: this.sessionId,
      text: text.trim(),
      userToken: this.authService.token || undefined,
      customerName: user?.fullName || undefined,
      customerPhone: user?.phoneNumber || undefined,
    });
  }
}
