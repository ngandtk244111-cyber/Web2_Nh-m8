import { AfterViewChecked, Component, ElementRef, effect, HostListener, OnDestroy, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AiAssistantService, AiChatMessage, AiSuggestedProduct } from '../../core/services/ai-assistant.service';
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

  /** Panel danh sách hội thoại đã lưu. */
  readonly showHistory = signal(false);
  /** Tin của khách đang được sửa (id) + nội dung đang sửa. */
  readonly editingId = signal<string | null>(null);
  editText = '';
  /** Tin vừa bấm Copy — đổi icon thành dấu tick trong chốc lát. */
  readonly copiedId = signal<string | null>(null);

  /** Vị trí đang duyệt trong các tin đã gửi khi bấm ↑/↓ ở ô nhập (-1 = không duyệt). */
  private inputHistoryIndex = -1;
  private copiedTimer: ReturnType<typeof setTimeout> | null = null;

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
    if (!this.aiService.isOpen()) return;
    if (this.showHistory()) this.showHistory.set(false);
    else this.aiService.closeModal();
  }

  ngOnDestroy(): void {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
    }
    if (this.copiedTimer) clearTimeout(this.copiedTimer);
  }

  sendUserMessage(): void {
    if (!this.userInput.trim() || this.aiService.isBusy()) return;
    this.aiService.sendMessage(this.userInput);
    this.userInput = '';
    this.inputHistoryIndex = -1;
  }

  /** Nút gửi đổi thành nút Dừng khi AI đang trả lời. */
  onSubmit(): void {
    if (this.aiService.isBusy()) this.aiService.stop();
    else this.sendUserMessage();
  }

  // ===== Thao tác trên tin nhắn =====

  /** Tin AI có câu trả lời thật (không phải lời chào mặc định) và là tin cuối -> cho Thử lại. */
  canRegenerate(msg: AiChatMessage, isLast: boolean): boolean {
    return isLast && msg.sender === 'AI' && msg.id !== 'ai-init' && !this.aiService.isBusy();
  }

  async copy(msg: AiChatMessage): Promise<void> {
    try {
      await navigator.clipboard.writeText(msg.text.replace(/\*\*/g, ''));
      this.copiedId.set(msg.id);
      if (this.copiedTimer) clearTimeout(this.copiedTimer);
      this.copiedTimer = setTimeout(() => this.copiedId.set(null), 1500);
    } catch { /* trình duyệt chặn clipboard — bỏ qua */ }
  }

  startEdit(msg: AiChatMessage): void {
    if (this.aiService.isBusy()) return;
    this.editingId.set(msg.id);
    this.editText = msg.text;
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editText = '';
  }

  submitEdit(msg: AiChatMessage): void {
    if (!this.editText.trim()) return;
    this.aiService.editMessage(msg.id, this.editText);
    this.cancelEdit();
  }

  onEditKeydown(event: KeyboardEvent, msg: AiChatMessage): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      this.cancelEdit();
    } else if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      this.submitEdit(msg);
    }
  }

  // ===== Lịch sử hội thoại =====

  toggleHistory(): void {
    const next = !this.showHistory();
    if (next) this.aiService.loadConversations();
    this.showHistory.set(next);
  }

  openConversation(id: string): void {
    this.cancelEdit();
    this.aiService.openConversation(id);
    this.showHistory.set(false);
    this.scrollTarget = 'bottom';
  }

  newChat(): void {
    this.cancelEdit();
    this.aiService.newChat();
    this.showHistory.set(false);
  }

  deleteConversation(event: Event, id: string): void {
    event.stopPropagation();
    this.aiService.deleteConversation(id);
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
  }

  /** ↑/↓ ở ô nhập (khi ô trống hoặc đang duyệt) để lấy lại các tin đã gửi, giống Chatbox. */
  onInputArrow(event: Event, direction: 'up' | 'down'): void {
    const sent = this.aiService.messages().filter(m => m.sender === 'USER').map(m => m.text).reverse();
    if (!sent.length) return;
    if (this.inputHistoryIndex === -1 && (direction === 'down' || this.userInput.trim())) return;

    event.preventDefault();
    const next = direction === 'up'
      ? Math.min(this.inputHistoryIndex + 1, sent.length - 1)
      : this.inputHistoryIndex - 1;
    this.inputHistoryIndex = next;
    this.userInput = next === -1 ? '' : sent[next];
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
