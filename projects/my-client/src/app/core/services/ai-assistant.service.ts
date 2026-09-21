import { Injectable, signal } from '@angular/core';
import { DesignBrief } from '../models/custom-request.model';
import { Router } from '@angular/router';

export interface AiChatMessage {
  id: string;
  sender: 'USER' | 'AI';
  text: string;
  time: string;
  quickReplies?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class AiAssistantService {
  private isOpenSignal = signal<boolean>(false);
  readonly isOpen = this.isOpenSignal.asReadonly();

  // Conversation history
  private messagesSignal = signal<AiChatMessage[]>([
    {
      id: 'ai-init',
      sender: 'AI',
      text: 'Chào bạn! Mình là AI Idea Assistant của Luméa ✨. Bạn đang có ý tưởng đồ decor hay nội thất in 3D nào trong đầu chưa? Hãy mô tả tự nhiên cho mình nghe nhé (Ví dụ: "Tôi muốn làm một chiếc đèn nhỏ hình mèo" hoặc "Một khay cắm bút phong cách núi Phú Sĩ").',
      time: 'Vừa xong',
      quickReplies: [
        'Đèn ngủ mini hình mèo dễ thương',
        'Bình hoa hình học phong cách Japandi',
        'Khay đựng phụ kiện bàn làm việc',
        'Tượng decor dải vô tận'
      ]
    }
  ]);
  readonly messages = this.messagesSignal.asReadonly();

  // Generated Design Brief
  private currentBriefSignal = signal<DesignBrief | null>(null);
  readonly currentBrief = this.currentBriefSignal.asReadonly();

  // Generated Concept Image
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

    const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const userMsg: AiChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'USER',
      text: userText,
      time,
    };

    this.messagesSignal.update(msgs => [...msgs, userMsg]);
    this.isThinkingSignal.set(true);

    // AI intelligent conversational parser & reply generator
    setTimeout(() => {
      this.generateAiResponse(userText);
      this.isThinkingSignal.set(false);
    }, 900);
  }

  private generateAiResponse(userText: string): void {
    const textLower = userText.toLowerCase();
    const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const currentBrief = this.currentBriefSignal();

    // Check if user is starting or replying to questions
    if (!currentBrief) {
      // Step 1: Initial user intent
      let detectedType = 'Đồ decor in 3D';
      let theme = 'Mèo cuộn tròn';
      let style = 'Minimalist bo tròn';
      let conceptImg = 'https://images.unsplash.com/photo-1574158622682-e40e69881006?auto=format&fit=crop&w=700&q=80';

      if (textLower.includes('đèn') || textLower.includes('mèo') || textLower.includes('cat')) {
        detectedType = 'Đèn ngủ mini (Bedside Lamp)';
        theme = 'Chú mèo con cuộn tròn ngủ yên bình';
        style = 'Minimalist / Cute Soft Lines';
        conceptImg = 'https://images.unsplash.com/photo-1574158622682-e40e69881006?auto=format&fit=crop&w=700&q=80';
      } else if (textLower.includes('bình') || textLower.includes('hoa') || textLower.includes('vase')) {
        detectedType = 'Bình hoa nghệ thuật (Parametric Vase)';
        theme = 'Đường cong xoắn ốc gợn sóng';
        style = 'Parametric & Japandi';
        conceptImg = 'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?auto=format&fit=crop&w=700&q=80';
      } else if (textLower.includes('khay') || textLower.includes('bút') || textLower.includes('organizer')) {
        detectedType = 'Khay bàn đa năng (Desk Organizer)';
        theme = 'Đa tầng chia ngăn tiện lợi';
        style = 'Scandinavian Hiện Đại';
        conceptImg = 'https://images.unsplash.com/photo-1585776245991-cf89dd7fc73a?auto=format&fit=crop&w=700&q=80';
      } else {
        detectedType = 'Vật phẩm Decor Điêu Khắc';
        theme = userText;
        style = 'Geometric Abstract';
        conceptImg = 'https://images.unsplash.com/photo-1544457070-4cd773b4d71e?auto=format&fit=crop&w=700&q=80';
      }

      const initialBrief: DesignBrief = {
        productType: detectedType,
        theme,
        style,
        color: 'Trắng sứ ngà (Warm White)',
        size: 'Khoảng 18cm - 20cm',
        usage: 'Trang trí đầu giường ngủ hoặc bàn học',
        customText: 'Không khắc',
        notes: userText,
      };

      this.currentBriefSignal.set(initialBrief);
      this.conceptImageSignal.set(conceptImg);

      const aiMsg: AiChatMessage = {
        id: 'msg-' + Date.now(),
        sender: 'AI',
        text: `Ý tưởng rất tuyệt vời! Mình đã phân tích sơ bộ: một chiếc **${detectedType}** lấy cảm hứng từ **"${theme}"** ✨.\n\nĐể bản thiết kế sát nhất với mong muốn của bạn:\n1. Bạn muốn phong cách thiên về **Cute đáng yêu**, **Tối giản (Minimalist)** hay **Hình học sắc sảo (Geometric)**?\n2. Bạn có muốn khắc thêm **tên riêng hoặc ngày kỷ niệm** lên sản phẩm không?`,
        time,
        quickReplies: [
          'Phong cách Minimalist tối giản, màu trắng ngà',
          'Phong cách Cute bo tròn, khắc chữ "Luna"',
          'Phong cách Geometric góc cạnh, không khắc chữ',
        ]
      };
      this.messagesSignal.update(msgs => [...msgs, aiMsg]);

    } else {
      // Step 2: Refine brief with user's specific answers
      const updatedBrief = { ...currentBrief };

      if (textLower.includes('cute') || textLower.includes('đáng yêu')) {
        updatedBrief.style = 'Cute Soft Curves (Bo tròn mềm)';
      } else if (textLower.includes('geometric') || textLower.includes('góc cạnh')) {
        updatedBrief.style = 'Geometric Low-Poly';
      } else if (textLower.includes('minimal')) {
        updatedBrief.style = 'Minimalist Nordic';
      }

      // Check text to engrave
      if (textLower.includes('khắc') || textLower.includes('luna') || textLower.includes('chữ')) {
        const match = userText.match(/["“](.*?)["”]/) || userText.match(/khắc chữ ([\w\s]+)/i);
        updatedBrief.customText = match ? match[1].trim() : 'Luna';
      }

      if (textLower.includes('màu')) {
        updatedBrief.color = userText;
      }

      this.currentBriefSignal.set(updatedBrief);

      const aiMsg: AiChatMessage = {
        id: 'msg-' + Date.now(),
        sender: 'AI',
        text: `Tuyệt vời! Mình đã hoàn thiện **Design Brief** và phác thảo hình ảnh Concept cho bạn bên dưới 👇.\n\nBạn có thể xem ảnh phác họa, chỉnh lại ý tưởng hoặc bấm nút **"Sử dụng ý tưởng này (Use This Idea)"** để chuyển trực tiếp sang form yêu cầu shop báo giá và chuẩn bị mô hình 3D!`,
        time,
        quickReplies: [
          'Đổi sang màu vàng pastel dịu nhẹ',
          'Đổi kích thước to hơn (khoảng 25cm)',
          'Ý tưởng này rất ổn, sẵn sàng gửi shop!'
        ]
      };
      this.messagesSignal.update(msgs => [...msgs, aiMsg]);
    }
  }

  regenerateConcept(): void {
    this.isThinkingSignal.set(true);
    setTimeout(() => {
      // Alternate concept preview
      const alt = 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=700&q=80';
      this.conceptImageSignal.set(alt);
      this.isThinkingSignal.set(false);
    }, 800);
  }

  useThisIdea(): void {
    const brief = this.currentBriefSignal();
    const concept = this.conceptImageSignal();
    if (!brief) return;

    this.closeModal();

    // Navigate to Create Your Own page with pre-filled state
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
    this.messagesSignal.set([
      {
        id: 'ai-init',
        sender: 'AI',
        text: 'Chào bạn! Mình là AI Idea Assistant của Luméa ✨. Hãy cho mình biết ý tưởng trang trí bạn muốn thực hiện nhé!',
        time: 'Vừa xong',
        quickReplies: [
          'Đèn ngủ mini hình mèo dễ thương',
          'Bình hoa hình học phong cách Japandi',
          'Khay đựng phụ kiện bàn làm việc',
        ]
      }
    ]);
  }
}
