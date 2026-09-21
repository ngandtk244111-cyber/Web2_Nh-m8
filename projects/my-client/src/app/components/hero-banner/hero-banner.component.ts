import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HeroTickerService } from '../../core/services/hero-ticker.service';
import { AiAssistantService } from '../../core/services/ai-assistant.service';
import { AppIconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-hero-banner',
  standalone: true,
  imports: [CommonModule, RouterLink, AppIconComponent],
  templateUrl: './hero-banner.component.html',
  styleUrl: './hero-banner.component.css'
})
export class HeroBannerComponent {
  constructor(
    public tickerService: HeroTickerService,
    private aiService: AiAssistantService
  ) {}

  get activeItem() {
    return this.tickerService.items[this.tickerService.activeIndex()];
  }

  onCtaClick(itemId: string, ev: Event): void {
    if (itemId === 'ai-assistant') {
      ev.preventDefault();
      this.aiService.openModal();
    }
  }

  onMouseEnter(): void {
    this.tickerService.pause();
  }

  onMouseLeave(): void {
    this.tickerService.resume();
  }

  goPrev(): void {
    const total = this.tickerService.items.length;
    this.tickerService.setActive(this.tickerService.activeIndex() - 1 + total);
  }

  goNext(): void {
    this.tickerService.setActive(this.tickerService.activeIndex() + 1);
  }
}
