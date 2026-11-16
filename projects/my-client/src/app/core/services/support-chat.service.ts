import { Injectable, computed, inject, signal, effect, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { io, Socket } from 'socket.io-client';
import { AuthService } from './auth.service';
import { ChatPanelService } from './chat-panel.service';
import { ToastService } from './toast.service';
import { environment } from '../../../environments/environment';

export interface ChatMessage {
  _id?: string;
  sessionId: string;
  sender: 'customer' | 'staff';
  text: string;
  createdAt?: string;
  /** Tin do trợ lý tự động gửi. */
  auto?: boolean;
  /** Nút dẫn tới trang liên quan (đường dẫn nội bộ, VD '/orders/track'). */
  links?: { label: string; url: string }[];
}

@Injectable({ providedIn: 'root' })
export class SupportChatService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private chatPanel = inject(ChatPanelService);
  private toast = inject(ToastService);

  private socket: Socket | null = null;
  private connecting = false;
  private lastReadAt = Date.now();
  private pendingMessages: string[] = [];
  readonly messages = signal<ChatMessage[]>([]);
  readonly isOpen = computed(() => this.chatPanel.active() === 'support');
  sessionId = '';

  /** Có nhân viên đang mở trang quản trị (phòng "staff" của socket) — chấm xanh trên khung chat. */
  readonly staffOnline = signal(false);
  /** Nhân viên đang gõ trả lời — hiện bong bóng ba chấm. */
  readonly staffTyping = signal(false);

  /** Số tin nhân viên gửi tới trong lúc khung chat đang đóng — hiện trên nút chat nổi. */
  readonly unreadCount = signal(0);

  private typingSent = false;
  private typingStopTimer: ReturnType<typeof setTimeout> | null = null;
  private staffTypingTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {

    // Khung chat có thể được mở tự động sau khi đăng nhập (ChatPanelService) -> kết nối khi khung mở.
    // Mở khung = đã đọc hết tin.
    effect(() => {
      if (this.isOpen()) untracked(() => {
        this.ensureConnected();
        this.markRead();
      });
    });
    // Khách đã đăng nhập thì kết nối sẵn (chat chỉ dành cho khách đăng nhập), để vẫn nhận tin
    // nhân viên trả lời khi khung đang đóng và báo số tin chưa đọc trên nút chat.
    effect(() => {
      const userId = this.authService.currentUser()?._id;
      untracked(() => {
        this.socket?.disconnect(); this.socket = null;
        this.connecting = false; this.sessionId = ''; this.pendingMessages = [];
        this.messages.set([]); this.unreadCount.set(0);
        if (userId) this.ensureConnected();
      });
    });
  }

  private readLastRead(): number { return this.lastReadAt; }

  private markRead(): void {
    this.unreadCount.set(0);
    this.lastReadAt = Date.now();
    if (this.authService.currentUser()) this.http.post(environment.apiUrl + '/chat/mine/read', {}).subscribe({ error: () => {} });
  }

  private ensureConnected(): void {
    const userId = this.authService.currentUser()?._id;
    if (this.socket || this.connecting || !userId) return;
    this.connecting = true;
    this.http.get<{ sessionId: string; messages: ChatMessage[]; lastReadAt: string | null }>(environment.apiUrl + '/chat/mine').subscribe({
      next: res => {
        if (userId !== this.authService.currentUser()?._id) return;
        this.connecting = false;
        this.sessionId = res.sessionId;
        this.messages.set(res.messages);
        this.lastReadAt = res.lastReadAt ? Date.parse(res.lastReadAt) : 0;
        this.unreadCount.set(res.messages.filter(m => m.sender === 'staff' && !m.auto && m.createdAt && Date.parse(m.createdAt) > this.lastReadAt).length);
        this.connectSocket();
        if (this.isOpen()) this.markRead();
      },
      error: () => { if (userId === this.authService.currentUser()?._id) { this.connecting = false; this.toast.error('Không tải được lịch sử hỗ trợ. Hãy mở lại khung chat.'); } },
    });
  }

  private connectSocket(): void {
    this.socket = io(environment.socketUrl);
    this.socket.on('connect', () => {
      this.socket?.emit('chat:join', { sessionId: this.sessionId, userToken: this.authService.token }, (res: { success: boolean }) => {
        if (!res.success) return;
        const pending = this.pendingMessages.splice(0);
        pending.forEach(text => this.sendMessage(text));
      });
    });
    this.socket.on('disconnect', () => this.staffOnline.set(false));
    this.socket.on('chat:message', (message: ChatMessage) => {
      if (message.sender === 'staff') this.setStaffTyping(false);
      const isNew = !message._id || !this.messages().some(m => m._id === message._id);
      this.appendMessage(message);
      if (message.sender !== 'staff' || !isNew) return;
      if (this.isOpen()) {
        this.markRead();
      } else {
        this.unreadCount.update(n => n + 1);
        // Tin tự động chỉ là trả lời tức thì cho câu khách vừa gửi -> không cần báo riêng.
        if (!message.auto) this.toast.info('Luméa vừa trả lời bạn trong khung chat hỗ trợ.');
      }
    });
    this.socket.on('chat:staff-status', ({ online }: { online: boolean }) => {
      this.staffOnline.set(!!online);
      if (!online) this.setStaffTyping(false);
    });
    this.socket.on('chat:typing', ({ typing }: { typing: boolean }) => this.setStaffTyping(!!typing));

  }

  /** Tự tắt ba chấm sau 6s nếu không nhận được tín hiệu dừng (mất mạng giữa chừng...). */
  private setStaffTyping(typing: boolean): void {
    if (this.staffTypingTimer) clearTimeout(this.staffTypingTimer);
    this.staffTypingTimer = typing ? setTimeout(() => this.staffTyping.set(false), 6000) : null;
    this.staffTyping.set(typing);
  }

  /** Gọi mỗi khi khách gõ: báo "đang gõ" 1 lần, tự báo dừng sau 2.5s không gõ thêm. */
  notifyTyping(): void {
    if (!this.socket) return;
    if (!this.typingSent) {
      this.typingSent = true;
      this.socket.emit('chat:typing', { sessionId: this.sessionId, typing: true });
    }
    if (this.typingStopTimer) clearTimeout(this.typingStopTimer);
    this.typingStopTimer = setTimeout(() => this.stopTyping(), 2500);
  }

  private stopTyping(): void {
    if (this.typingStopTimer) clearTimeout(this.typingStopTimer);
    this.typingStopTimer = null;
    if (!this.typingSent) return;
    this.typingSent = false;
    this.socket?.emit('chat:typing', { sessionId: this.sessionId, typing: false });
  }

  private appendMessage(message: ChatMessage): void {
    this.messages.update(list => (message._id && list.some(m => m._id === message._id) ? list : [...list, message]));
  }

  /** Chưa đăng nhập thì ChatPanelService mở popup đăng nhập thay vì mở khung chat. */
  open(): void {
    this.chatPanel.open('support');
  }

  close(): void {
    this.stopTyping();
    this.chatPanel.close('support');
  }

  sendMessage(text: string): void {
    if (!text.trim()) return;
    if (!this.authService.currentUser()) { this.open(); return; }
    if (!this.socket?.connected) { this.pendingMessages.push(text.trim()); this.ensureConnected(); return; }
    this.stopTyping();
    // Khách đã đăng nhập thì gửi kèm tên/SĐT để nhân viên biết đang nói chuyện với ai.
    const user = this.authService.currentUser();
    this.socket?.emit('chat:message', {
      sessionId: this.sessionId,
      text: text.trim(),
      userToken: this.authService.token || undefined,
      customerName: user?.fullName || undefined,
      customerPhone: user?.phoneNumber || undefined,
    });
  }
}
