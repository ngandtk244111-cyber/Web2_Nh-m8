import { Component, HostListener, NgZone, OnDestroy, OnInit, computed, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NewsService } from '../../core/services/news.service';
import { TipPopupService } from '../../core/services/tip-popup.service';
import { AppIconComponent } from '../icon/icon.component';

/** Mở popup khi người dùng đã cuộn qua tỉ lệ này của trang — thay cho mở sau 3s, tránh chồng lên hero/banner lúc vừa vào. */
const OPEN_SCROLL_RATIO = 0.4;
const CLOSE_ANIMATION_MS = 250;

@Component({
  selector: 'app-tip-popup',
  standalone: true,
  imports: [CommonModule, AppIconComponent],
  templateUrl: './tip-popup.component.html',
  styleUrl: './tip-popup.component.css'
})
export class TipPopupComponent implements OnInit, OnDestroy {
  private readonly scrolledEnough = signal(false);
  readonly closing = signal(false);

  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  readonly article;
  readonly visible;

  constructor(
    private newsService: NewsService,
    private tipPopupService: TipPopupService,
    private router: Router,
    private zone: NgZone
  ) {
    this.article = this.newsService.featuredArticle;
    this.visible = computed(() =>
      this.scrolledEnough() && !this.tipPopupService.dismissed() && !!this.article()
    );

    effect(() => {
      document.body.style.overflow = this.visible() ? 'hidden' : '';
    });
  }

  // Nghe scroll ngoài Angular zone để không chạy change detection mỗi lần cuộn; chỉ vào zone khi cần mở.
  private readonly onScroll = () => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollable <= 0 || window.scrollY / scrollable < OPEN_SCROLL_RATIO) return;
    this.stopListening();
    this.zone.run(() => this.scrolledEnough.set(true));
  };

  ngOnInit(): void {
    this.zone.runOutsideAngular(() => window.addEventListener('scroll', this.onScroll, { passive: true }));
  }

  private stopListening(): void {
    window.removeEventListener('scroll', this.onScroll);
  }

  ngOnDestroy(): void {
    this.stopListening();
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
