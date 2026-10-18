import { AfterViewChecked, Component, ElementRef, ViewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupportChatService } from '../../core/services/support-chat.service';
import { AppIconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-support-chat-widget',
  standalone: true,
  imports: [CommonModule, FormsModule, AppIconComponent],
  templateUrl: './support-chat-widget.component.html',
  styleUrl: './support-chat-widget.component.css'
})
export class SupportChatWidgetComponent implements AfterViewChecked {
  draft = '';
  /** Câu hỏi nhanh khi chưa có tin nào — gửi đi để trợ lý tự động trả lời kèm nút dẫn trang. */
  readonly quickReplies = ['Tra cứu đơn hàng', 'Phí giao hàng', 'Đổi trả hàng', 'Bảo hành', 'Đặt làm theo yêu cầu', 'Gặp nhân viên'];

  @ViewChild('body') private bodyEl?: ElementRef<HTMLDivElement>;
  private scrollPending = false;

  constructor(public chatService: SupportChatService, private router: Router) {
    // Tin mới / ba chấm xuất hiện / vừa mở khung -> cuộn xuống cuối.
    effect(() => {
      this.chatService.messages();
      this.chatService.staffTyping();
      this.chatService.isOpen();
      this.scrollPending = true;
    });
  }

  ngAfterViewChecked(): void {
    const el = this.bodyEl?.nativeElement;
    if (!this.scrollPending || !el) return;
    this.scrollPending = false;
    el.scrollTop = el.scrollHeight;
  }

  toggle(): void {
    if (this.chatService.isOpen()) {
      this.chatService.close();
    } else {
      this.chatService.open();
    }
  }

  onDraftChange(): void {
    if (this.draft.trim()) this.chatService.notifyTyping();
  }

  send(): void {
    if (!this.draft.trim()) return;
    this.chatService.sendMessage(this.draft);
    this.draft = '';
  }

  sendQuick(text: string): void {
    this.chatService.sendMessage(text);
  }

  /** Nút gợi ý của trợ lý tự động: chuyển trang; trên điện thoại khung chat phủ kín màn nên đóng lại. */
  goTo(url: string): void {
    this.router.navigateByUrl(url);
    if (window.innerWidth <= 640) this.chatService.close();
  }
}
