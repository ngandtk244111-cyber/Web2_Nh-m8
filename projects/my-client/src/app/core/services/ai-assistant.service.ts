import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DesignBrief } from '../models/custom-request.model';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

export interface AiSuggestedProduct {
  id: string;
  name: string;
  slug: string;
  basePrice: number;
  images: string[];
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
  suggestedProducts: AiSuggestedProduct[];
  error?: string;
}

const BASE = `${environment.apiUrl}/ai`;

@Injectable({
  providedIn: 'root'
})
export class AiAssistantService {
  private http = inject(HttpClient);

  private isOpenSignal = signal<boolean>(false);
  readonly isOpen = this.isOpenSignal.asReadonly();

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
    this.isOpenSignal.set(true);
  }

  closeModal(): void {
    this.isOpenSignal.set(false);
  }

  sendMessage(userText: string): void {
    if (!userText.trim()) return;

    const userMsg: AiChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'USER',
      text: userText,
      time: this.now(),
    };
    this.messagesSignal.update(msgs => [...msgs, userMsg]);
    this.isThinkingSignal.set(true);

    const history = this.messagesSignal().map(m => ({ sender: m.sender, text: m.text }));

    this.http.post<AiAssistantResponse>(`${BASE}/assistant`, {
      userText,
      history,
      currentBrief: this.currentBriefSignal(),
    }).subscribe({
      next: (res) => this.applyResponse(res),
      error: () => this.applyResponse({
        success: false,
        reply: 'Xin lỗi, mình đang gặp sự cố kết nối AI. Bạn thử gửi lại tin nhắn sau ít phút nhé.',
        quickReplies: [],
        brief: null,
        suggestedProducts: [],
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
      suggestedProducts: res.suggestedProducts,
    };
    this.messagesSignal.update(msgs => [...msgs, aiMsg]);
    this.isThinkingSignal.set(false);
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
    setTimeout(() => {
      const alt = 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=700&q=80';
      this.conceptImageSignal.set(alt);
      this.isThinkingSignal.set(false);
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
