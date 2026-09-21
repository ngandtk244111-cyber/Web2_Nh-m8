import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AiAssistantService } from '../../core/services/ai-assistant.service';
import { AppIconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-floating-mascot',
  standalone: true,
  imports: [CommonModule, AppIconComponent],
  templateUrl: './floating-mascot.component.html',
  styleUrl: './floating-mascot.component.css'
})
export class FloatingMascotComponent {
  readonly dismissed = signal(false);

  constructor(private aiAssistantService: AiAssistantService) {}

  open(): void {
    this.aiAssistantService.openModal();
  }

  dismiss(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.dismissed.set(true);
  }
}
