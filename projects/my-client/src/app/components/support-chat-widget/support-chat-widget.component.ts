import { AfterViewChecked, Component, ElementRef, ViewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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

  @ViewChild('body') private bodyEl?: ElementRef<HTMLDivElement>;
  private scrollPending = false;

  constructor(public chatService: SupportChatService) {
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
}
