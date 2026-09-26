import { Component, DestroyRef, ElementRef, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { AppIconComponent } from '../../components/icon/icon.component';
import { POLICY_MENU } from './policy-menu';

/** Khung chung cho mọi trang Hỗ trợ & Chính sách: thanh điều hướng + nút "Menu tổng"
 *  để chuyển qua lại giữa các chính sách, nội dung từng trang nằm trong router-outlet. */
@Component({
  selector: 'app-policy-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, AppIconComponent],
  templateUrl: './policy-layout.component.html',
  styleUrl: './policy-layout.component.css'
})
export class PolicyLayoutComponent {
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly menu = POLICY_MENU;
  readonly menuOpen = signal(false);
  readonly currentLabel = signal('');

  constructor() {
    this.updateCurrentLabel();
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => {
        this.updateCurrentLabel();
        this.menuOpen.set(false);
      });
  }

  toggleMenu(): void {
    this.menuOpen.update(open => !open);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(ev: MouseEvent): void {
    if (!this.menuOpen()) return;
    const bar = (this.host.nativeElement as HTMLElement).querySelector('.pl-bar');
    if (bar && !bar.contains(ev.target as Node)) this.menuOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.menuOpen.set(false);
  }

  private updateCurrentLabel(): void {
    const slug = this.router.url.split(/[?#]/)[0].split('/').pop() || '';
    const item = this.menu.flatMap(g => g.items).find(i => i.slug === slug);
    this.currentLabel.set(item?.label ?? '');
  }
}
