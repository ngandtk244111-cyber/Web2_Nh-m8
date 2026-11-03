import { Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ChatService, ChatSession } from '../../core/services/chat.service';
import { normalizePhone } from '../../shared/utils/order-labels';

/** Tin nhắn hỗ trợ — khách nhắn qua khung chat trên cửa hàng (socket.io), tin mới hiện ngay. */
@Component({
  selector: 'app-messages',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './messages.component.html',
  styleUrl: './messages.component.css',
})
export class MessagesComponent implements OnInit, OnDestroy {
  readonly chat = inject(ChatService);

  @ViewChild('chatScroll') chatScroll?: ElementRef<HTMLDivElement>;

  readonly quickReplies = [
    'Chào bạn, Luméa có thể hỗ trợ gì cho bạn ạ?',
    'Bạn cho mình xin mã đơn hàng để kiểm tra nhé.',
    'Đơn của bạn đang được in 3D, dự kiến giao trong 3–5 ngày ạ.',
    'Cảm ơn bạn đã liên hệ Luméa!',
  ];

  search = signal('');
  draft = '';

  readonly filteredSessions = computed(() => {
    const q = this.search().trim().toLowerCase();
    const sessions = this.chat.sessions();
    if (!q) return sessions;
    return sessions.filter(s =>
      (s.customerName || '').toLowerCase().includes(q) ||
      (s.customerPhone || '').includes(q) ||
      s.lastText.toLowerCase().includes(q));
  });

  constructor() {
    // Có tin mới / khách đang gõ trong hội thoại đang mở thì cuộn xuống cuối (chờ Angular vẽ xong).
    effect(() => {
      this.chat.activeMessages();
      this.chat.activeTyping();
      setTimeout(() => {
        const el = this.chatScroll?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
      });
    });
  }

  ngOnInit(): void {
    this.chat.connect();
    this.chat.refreshSessions();
  }

  ngOnDestroy(): void {
    this.chat.closeSession();
  }

  /** Khách đã đăng nhập thì lấy tên, khách vãng lai thì lấy 4 số cuối mã phiên. */
  displayName(s: ChatSession | null): string {
    if (!s) return '';
    return s.customerName || s.customerPhone || `Khách vãng lai #${s.sessionId.slice(-4)}`;
  }

  initial(s: ChatSession): string {
    return s.customerName ? s.customerName.charAt(0).toUpperCase() : '?';
  }

  customerPhone(s: ChatSession): string {
    return normalizePhone(s.customerPhone);
  }

  /** Giờ nếu là hôm nay, ngày/tháng nếu cũ hơn. */
  timeLabel(iso: string | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toDateString() === new Date().toDateString()
      ? d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  }

  open(s: ChatSession): void {
    this.chat.openSession(s.sessionId);
    this.draft = '';
  }

  useQuickReply(text: string): void {
    this.draft = text;
  }

  onDraftInput(): void {
    if (this.draft.trim()) this.chat.notifyTyping();
  }

  send(): void {
    if (!this.draft.trim()) return;
    this.chat.send(this.draft);
    this.draft = '';
  }

  /** Enter gửi, Shift+Enter xuống dòng. */
  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  trackBySession = (_: number, s: ChatSession) => s.sessionId;
}
