import { Injectable, signal, inject, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DesignBrief } from '../models/custom-request.model';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { MascotService } from './mascot.service';
import { ChatPanelService } from './chat-panel.service';

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

@Injectable({
  providedIn: 'root'
})
export class AiAssistantService {
  private http = inject(HttpClient);
  private mascotService = inject(MascotService);
  private chatPanel = inject(ChatPanelService);

  readonly isOpen = computed(() => this.chatPanel.active() === 'ai');
  private readonly sessionId = `goh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Conversation history — tin nhắn chào ban đầu tạo qua hàm dùng chung với resetChat().
  private messagesSignal = signal<AiChatMessage[]>([this.buildWelcomeMessage()]);
  readonly messages = this.messagesSignal.asReadonly();

  // Generated Design Brief — cập nhật dần từ các trường AI trả về mỗi lượt chat.
  private currentBriefSignal = signal<DesignBrief | null>(null);
  readonly currentBrief = this.currentBriefSignal.asReadonly();

  // Generated Concept Image — vẫn là ảnh minh họa tĩnh chọn theo từ khóa (chưa có model sinh ảnh thật).
  private conceptImageSignal = signal<string | null>(null);
  readonly conceptImage = this.conceptImageSignal.asReadonly();

  private isThinkingSignal = signal<boolean>(false);
  readonly isThinking = this.isThinkingSignal.asReadonly();

  constructor(private router: Router) {}

  openModal(): void {
    this.chatPanel.open('ai');
  }

  closeModal(): void {
    this.chatPanel.close('ai');
  }

  sendMessage(userText: string): void {
    if (!userText.trim() || this.isThinkingSignal()) return;

    // Lịch sử gửi lên là các tin TRƯỚC tin hiện tại (tin hiện tại đi riêng trong userText), bỏ lời chào mặc định.
    const history = this.messagesSignal()
      .filter(m => m.id !== 'ai-init')
      .map(m => ({ sender: m.sender, text: m.text }));

    const userMsg: AiChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'USER',
      text: userText,
      time: this.now(),
    };
    this.messagesSignal.update(msgs => [...msgs, userMsg]);
    this.isThinkingSignal.set(true);
    this.mascotService.startThinking();

    this.http.post<AiAssistantResponse>(`${BASE}/assistant`, {
      userText,
      history,
      currentBrief: this.currentBriefSignal(),
      sessionId: this.sessionId,
    }).subscribe({
      next: (res) => this.applyResponse(res),
      error: () => this.applyResponse({
        success: false,
        reply: 'Xin lỗi, mình đang gặp sự cố kết nối AI. Bạn thử gửi lại tin nhắn sau ít phút nhé.',
        quickReplies: [],
        brief: null,
        products: [],
      }),
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
      id: 'msg-' + Date.now(),
      sender: 'AI',
      text: res.reply,
      time: this.now(),
      quickReplies: res.quickReplies,
      suggestedProducts: res.products ?? [],
    };
    this.messagesSignal.update(msgs => [...msgs, aiMsg]);
    this.isThinkingSignal.set(false);

    if (res.success === false) {
      this.mascotService.stopThinking('sad');
    } else if (res.brief) {
      // AI vừa đưa ra gợi ý/brief decor cụ thể — biểu cảm tự tin thay vì cười thường.
      this.mascotService.stopThinking('confident');
    } else {
      this.mascotService.stopThinking('happy');
    }
  }

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

  resetChat(): void {
    this.currentBriefSignal.set(null);
    this.conceptImageSignal.set(null);
    this.messagesSignal.set([this.buildWelcomeMessage()]);
  }

  private buildWelcomeMessage(): AiChatMessage {
    return {
      id: 'ai-init',
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
