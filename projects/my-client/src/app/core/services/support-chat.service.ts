import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { io, Socket } from 'socket.io-client';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

export interface ChatMessage {
  _id?: string;
  sessionId: string;
  sender: 'customer' | 'staff';
  text: string;
  createdAt?: string;
}

const SESSION_KEY = 'deco3d_chat_session';

@Injectable({ providedIn: 'root' })
export class SupportChatService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  private socket: Socket | null = null;
  private historyLoaded = false;
  readonly messages = signal<ChatMessage[]>([]);
  readonly isOpen = signal(false);
  readonly sessionId: string;

  constructor() {
    this.sessionId = this.loadOrCreateSessionId();
  }

  private loadOrCreateSessionId(): string {
    try {
      let id = localStorage.getItem(SESSION_KEY);
      if (!id) {
        id = 'sess-' + Date.now() + '-' + Math.floor(Math.random() * 100000);
        localStorage.setItem(SESSION_KEY, id);
      }
      return id;
    } catch {
      return 'sess-' + Date.now();
    }
  }

  private ensureConnected(): void {
    if (this.socket) return;

    this.socket = io(environment.socketUrl);
    this.socket.on('connect', () => {
      this.socket?.emit('chat:join', this.sessionId);
    });
    this.socket.on('chat:message', (message: ChatMessage) => this.appendMessage(message));
    this.loadHistory();
  }

  /** Nạp lại tin cũ (kể cả câu trả lời nhân viên gửi khi khách đã đóng trang). */
  private loadHistory(): void {
    if (this.historyLoaded) return;
    this.historyLoaded = true;
    this.http.get<{ success: boolean; messages: ChatMessage[] }>(`${environment.apiUrl}/chat/${this.sessionId}/messages`).subscribe({
      next: (res) => {
        if (!res.success) return;
        // Gộp với tin vừa nhận qua socket trong lúc chờ HTTP, bỏ trùng theo _id.
        const seen = new Set(res.messages.map(m => m._id));
        this.messages.update(live => [...res.messages, ...live.filter(m => !m._id || !seen.has(m._id))]);
      },
      error: () => { this.historyLoaded = false; },
    });
  }

  private appendMessage(message: ChatMessage): void {
    this.messages.update(list => (message._id && list.some(m => m._id === message._id) ? list : [...list, message]));
  }

  open(): void {
    this.ensureConnected();
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }

  sendMessage(text: string): void {
    if (!text.trim()) return;
    this.ensureConnected();
    // Khách đã đăng nhập thì gửi kèm tên/SĐT để nhân viên biết đang nói chuyện với ai.
    const user = this.authService.currentUser();
    this.socket?.emit('chat:message', {
      sessionId: this.sessionId,
      text: text.trim(),
      userId: user?._id,
      customerName: user?.fullName || undefined,
      customerPhone: user?.phoneNumber || undefined,
    });
  }
}
