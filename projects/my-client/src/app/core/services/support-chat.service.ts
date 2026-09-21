import { Injectable, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
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
  private socket: Socket | null = null;
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
    this.socket.on('chat:message', (message: ChatMessage) => {
      this.messages.update(list => [...list, message]);
    });
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
    this.socket?.emit('chat:message', { sessionId: this.sessionId, sender: 'customer', text: text.trim() });
  }
}
