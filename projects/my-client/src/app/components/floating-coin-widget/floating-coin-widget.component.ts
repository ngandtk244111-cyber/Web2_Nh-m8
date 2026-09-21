import { Component, ElementRef, HostListener, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CoinService } from '../../core/services/coin.service';
import { AuthService } from '../../core/services/auth.service';
import { LoginModalService } from '../../core/services/login-modal.service';
import { AppIconComponent } from '../icon/icon.component';

/** Túi xu nổi góc màn hình — bấm vào để xem nhanh số dư Xu Luméa hiện có. */
@Component({
  selector: 'app-floating-coin-widget',
  standalone: true,
  imports: [CommonModule, RouterLink, AppIconComponent],
  templateUrl: './floating-coin-widget.component.html',
  styleUrl: './floating-coin-widget.component.css'
})
export class FloatingCoinWidgetComponent {
  readonly panelOpen = signal(false);

  constructor(
    public coinService: CoinService,
    public authService: AuthService,
    public loginModalService: LoginModalService,
    private elementRef: ElementRef<HTMLElement>
  ) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.panelOpen.set(false);
    }
  }

  toggle(): void {
    if (!this.authService.currentUser()) {
      this.loginModalService.open();
      return;
    }
    this.panelOpen.update(v => !v);
  }

  close(): void {
    this.panelOpen.set(false);
  }
}
