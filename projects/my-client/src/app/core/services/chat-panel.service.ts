import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from './auth.service';
import { LoginModalService } from './login-modal.service';
import { ToastService } from './toast.service';

export type ActiveChatPanel = 'none' | 'ai' | 'support';

/**
 * Chỉ cho mở 1 khung chat tại một thời điểm: trợ lý AI (Lami) hoặc chat hỗ trợ trực tiếp.
 * Cả hai đều cần đăng nhập (giống Long Châu): chưa đăng nhập thì mở popup đăng nhập, đăng nhập xong
 * tự mở luôn khung chat vừa bấm; đăng xuất thì đóng khung đang mở.
 */
@Injectable({ providedIn: 'root' })
export class ChatPanelService {
  private readonly auth = inject(AuthService);
  private readonly loginModal = inject(LoginModalService);
  private readonly toast = inject(ToastService);

  readonly active = signal<ActiveChatPanel>('none');
  /** Khung chat khách bấm lúc chưa đăng nhập — mở ngay sau khi đăng nhập xong. */
  private pending: 'ai' | 'support' | null = null;

  constructor() {
    effect(() => {
      const loggedIn = !!this.auth.currentUser();
      untracked(() => {
        if (!loggedIn) {
          this.active.set('none');
          return;
        }
        if (this.pending) {
          this.active.set(this.pending);
          this.pending = null;
        }
      });
    });
  }

  open(panel: 'ai' | 'support'): void {
    if (!this.requireLogin(panel)) return;
    this.active.set(panel);
  }

  close(panel?: 'ai' | 'support'): void {
    if (!panel || this.active() === panel) this.active.set('none');
  }

  toggle(panel: 'ai' | 'support'): void {
    if (this.active() === panel) {
      this.active.set('none');
      return;
    }
    this.open(panel);
  }

  private requireLogin(panel: 'ai' | 'support'): boolean {
    if (this.auth.currentUser()) return true;
    this.pending = panel;
    this.toast.info(panel === 'ai'
      ? 'Vui lòng đăng nhập để trò chuyện với trợ lý AI.'
      : 'Vui lòng đăng nhập để được tư vấn trực tuyến.');
    this.loginModal.open();
    return false;
  }
}
