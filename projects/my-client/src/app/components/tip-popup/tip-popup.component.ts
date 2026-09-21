import { Component, HostListener, OnDestroy, OnInit, computed, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NewsService } from '../../core/services/news.service';
import { TipPopupService } from '../../core/services/tip-popup.service';
import { AppIconComponent } from '../icon/icon.component';

const OPEN_DELAY_MS = 3000;
const CLOSE_ANIMATION_MS = 250;

@Component({
  selector: 'app-tip-popup',
  standalone: true,
  imports: [CommonModule, AppIconComponent],
  templateUrl: './tip-popup.component.html',
  styleUrl: './tip-popup.component.css'
})
export class TipPopupComponent implements OnInit, OnDestroy {
  private readonly timerElapsed = signal(false);
  readonly closing = signal(false);

  private openTimer: ReturnType<typeof setTimeout> | null = null;
  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  readonly article;
  readonly visible;

  constructor(
    private newsService: NewsService,
    private tipPopupService: TipPopupService,
    private router: Router
  ) {
    this.article = this.newsService.featuredArticle;
    this.visible = computed(() =>
      this.timerElapsed() && !this.tipPopupService.dismissed() && !!this.article()
    );

    effect(() => {
      document.body.style.overflow = this.visible() ? 'hidden' : '';
    });
  }

  ngOnInit(): void {
    this.openTimer = setTimeout(() => this.timerElapsed.set(true), OPEN_DELAY_MS);
  }

  ngOnDestroy(): void {
    if (this.openTimer) clearTimeout(this.openTimer);
    if (this.closeTimer) clearTimeout(this.closeTimer);
    document.body.style.overflow = '';
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.visible()) this.close();
  }

  close(): void {
    if (this.closing()) return;
    this.closing.set(true);
    this.closeTimer = setTimeout(() => {
      this.tipPopupService.dismiss();
      this.closing.set(false);
      document.body.style.overflow = '';
    }, CLOSE_ANIMATION_MS);
  }

  goToArticle(): void {
    const slug = this.article()?.slug;
    this.close();
    if (slug) this.router.navigate(['/news', slug]);
  }
}
