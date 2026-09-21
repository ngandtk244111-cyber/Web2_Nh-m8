import { Component } from '@angular/core';
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
export class SupportChatWidgetComponent {
  draft = '';

  constructor(public chatService: SupportChatService) {}

  toggle(): void {
    if (this.chatService.isOpen()) {
      this.chatService.close();
    } else {
      this.chatService.open();
    }
  }

  send(): void {
    if (!this.draft.trim()) return;
    this.chatService.sendMessage(this.draft);
    this.draft = '';
  }
}
