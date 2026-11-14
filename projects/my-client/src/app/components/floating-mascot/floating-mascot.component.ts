import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AiAssistantService } from '../../core/services/ai-assistant.service';
import { MascotService, MascotExpression } from '../../core/services/mascot.service';
import { AppIconComponent } from '../icon/icon.component';

// Mỗi biểu cảm dùng 1 ảnh Lami riêng — đổi biểu cảm thì đổi luôn ảnh, kèm animation pulse nhẹ.
const MASCOT_IMAGES: Record<MascotExpression, string> = {
  idle: 'assets/mascot/goh-mascot.png',
  thinking: 'assets/mascot/goh-thinking.png',
  happy: 'assets/mascot/goh-happy.png',
  surprised: 'assets/mascot/goh-surprised.png',
  confident: 'assets/mascot/goh-confident.png',
  sad: 'assets/mascot/goh-sad.png',
  angry: 'assets/mascot/goh-angry.png',
};

const MASCOT_ALT: Record<MascotExpression, string> = {
  idle: 'Lami mascot',
  thinking: 'Lami đang suy nghĩ',
  happy: 'Lami đang cười',
  surprised: 'Lami ngạc nhiên',
  confident: 'Lami tự tin',
  sad: 'Lami buồn',
  angry: 'Lami khó chịu',
};

@Component({
  selector: 'app-floating-mascot',
  standalone: true,
  imports: [CommonModule, AppIconComponent],
  templateUrl: './floating-mascot.component.html',
  styleUrl: './floating-mascot.component.css'
})
export class FloatingMascotComponent {
  private readonly mascotService = inject(MascotService);

  readonly dismissed = signal(false);
  readonly expression = this.mascotService.expression;
  readonly mascotImg = computed(() => MASCOT_IMAGES[this.expression()]);
  readonly mascotAlt = computed(() => MASCOT_ALT[this.expression()]);
  /** true trong ~260ms mỗi lần biểu cảm đổi — kích hoạt animation pulse nhẹ, không nhảy giật. */
  readonly pulsing = signal(false);

  constructor(private aiAssistantService: AiAssistantService) {
    effect(() => {
      this.expression();
      this.pulsing.set(true);
      setTimeout(() => this.pulsing.set(false), 260);
    });
  }

  open(): void {
    this.aiAssistantService.openModal();
  }

  dismiss(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.dismissed.set(true);
  }
}
