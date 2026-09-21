import { Component, effect, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AiAssistantService } from '../../core/services/ai-assistant.service';
import { AppIconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-ai-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, AppIconComponent],
  templateUrl: './ai-modal.component.html',
  styleUrl: './ai-modal.component.css'
})
export class AiModalComponent implements OnDestroy {
  userInput = '';

  constructor(public aiService: AiAssistantService) {
    effect(() => {
      const isOpen = this.aiService.isOpen();
      if (typeof document !== 'undefined') {
        document.body.style.overflow = isOpen ? 'hidden' : '';
      }
    });
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
}
