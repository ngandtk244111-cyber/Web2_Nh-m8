import { AfterViewChecked, Component, ElementRef, effect, HostListener, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AiAssistantService, AiSuggestedProduct } from '../../core/services/ai-assistant.service';
import { MascotService } from '../../core/services/mascot.service';
import { AppIconComponent } from '../icon/icon.component';
import { VndPipe } from '../../shared/pipes/vnd.pipe';

interface TextRun {
  text: string;
  bold: boolean;
}

@Component({
  selector: 'app-ai-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, AppIconComponent, VndPipe],
  templateUrl: './ai-modal.component.html',
  styleUrl: './ai-modal.component.css'
})
export class AiModalComponent implements AfterViewChecked, OnDestroy {
  userInput = '';

  @ViewChild('body') private bodyEl?: ElementRef<HTMLDivElement>;

  /** Cuộn sau khi view cập nhật: tin khách / đang soạn -> xuống cuối; câu trả lời của Goh -> tới ĐẦU câu trả lời
   *  (câu dài + thẻ sản phẩm vẫn đọc được từ đầu, giống AruBot của AuraPC). */
  private scrollTarget: 'bottom' | 'last-reply' | null = null;

  constructor(
    public aiService: AiAssistantService,
    public mascotService: MascotService,
    private router: Router
  ) {
    effect(() => {
      const isOpen = this.aiService.isOpen();
      if (typeof document !== 'undefined') {
        document.body.style.overflow = isOpen ? 'hidden' : '';
      }
      if (isOpen) this.scrollTarget = 'bottom';
    });
    effect(() => {
      const msgs = this.aiService.messages();
      const thinking = this.aiService.isThinking();
      const last = msgs[msgs.length - 1];
      this.scrollTarget = !thinking && last?.sender === 'AI' && msgs.length > 1 ? 'last-reply' : 'bottom';
    });
  }

  ngAfterViewChecked(): void {
    const target = this.scrollTarget;
    const el = this.bodyEl?.nativeElement;
    if (!target || !el) return;
    this.scrollTarget = null;

    if (target === 'last-reply') {
      const rows = el.querySelectorAll<HTMLElement>('.aic_row');
      const row = rows[rows.length - 1];
      if (row) {
        const top = row.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 8;
        el.scrollTo({ top, behavior: 'smooth' });
        return;
      }
    }
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }

  @HostListener('document:keydown.escape')
  onEscapePress(): void {
    if (this.aiService.isOpen()) {
      this.aiService.closeModal();
    }
  }

  ngOnDestroy(): void {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
    }
  }

  sendUserMessage(): void {
    if (!this.userInput.trim()) return;
    this.aiService.sendMessage(this.userInput);
    this.userInput = '';
  }

  sendQuickReply(reply: string): void {
    this.aiService.sendMessage(reply);
  }

  /** Enter = gửi, Shift+Enter = xuống dòng. */
  onEnter(event: Event): void {
    const e = event as KeyboardEvent;
    if (e.shiftKey || e.isComposing) return;
    e.preventDefault();
    this.sendUserMessage();
  }

  /** Tách **in đậm** trong câu trả lời thành từng đoạn để render bằng template (không dùng innerHTML). */
  runs(text: string): TextRun[] {
    return (text || '').split('**').map((part, i) => ({ text: part, bold: i % 2 === 1 })).filter(r => r.text !== '');
  }

  discountPercent(p: AiSuggestedProduct): number {
    return p.originalPrice && p.originalPrice > p.price
      ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100)
      : 0;
  }

  /** Có slug -> trang sản phẩm; không có -> tìm theo tên ở catalog. Mở xong thì đóng khung chat. */
  openProduct(p: AiSuggestedProduct): void {
    if (p.slug) {
      this.router.navigate(['/product', p.slug]);
    } else if (p.name) {
      this.router.navigate(['/catalog'], { queryParams: { q: p.name } });
    } else {
      return;
    }
    this.aiService.closeModal();
  }
}
