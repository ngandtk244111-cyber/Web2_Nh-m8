import { Injectable, signal } from '@angular/core';

export type ActiveChatPanel = 'none' | 'ai' | 'support';

/** Chỉ cho mở 1 khung chat tại một thời điểm: trợ lý AI (Goh) hoặc chat hỗ trợ trực tiếp. */
@Injectable({ providedIn: 'root' })
export class ChatPanelService {
  readonly active = signal<ActiveChatPanel>('none');

  open(panel: 'ai' | 'support'): void {
    this.active.set(panel);
  }

  close(panel?: 'ai' | 'support'): void {
    if (!panel || this.active() === panel) this.active.set('none');
  }

  toggle(panel: 'ai' | 'support'): void {
    this.active.set(this.active() === panel ? 'none' : panel);
  }
}
