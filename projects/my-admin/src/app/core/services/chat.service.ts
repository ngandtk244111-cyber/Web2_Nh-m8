import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { io, Socket } from 'socket.io-client';
import { AdminAuthService } from './admin-auth.service';
import { environment } from '../../../environments/environment';

const BASE = `${environment.apiUrl}/chat`;

export interface ChatMessage {
  _id?: string;
  sessionId: string;
  sender: 'customer' | 'staff';
  text: string;
  userId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  createdAt?: string;
}

/** Một cuộc chat hỗ trợ (gom theo sessionId) trong hộp thư nhân viên. */
export interface ChatSession {
  sessionId: string;
  lastText: string;
  lastSender: 'customer' | 'staff';
  lastAt: string;
  startedAt: string;
  messageCount: number;
  unread: number;
  userId: string | null;
  customerName: string | null;
  customerPhone: string | null;
}

/**
 * Hộp thư hỗ trợ khách hàng: nhận tin realtime của mọi cuộc chat qua phòng "staff" của socket.io
 * (server chỉ cho vào phòng khi adminId hợp lệ) và trả lời vào đúng cuộc chat của khách.
 */
@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private http = inject(HttpClient);
  private adminAuth = inject(AdminAuthService);
  private socket: Socket | null = null;

  private sessionsSignal = signal<ChatSession[]>([]);
  private activeIdSignal = signal<string | null>(null);
  private messagesSignal = signal<ChatMessage[]>([]);

  readonly sessions = this.sessionsSignal.asReadonly();
  readonly activeSessionId = this.activeIdSignal.asReadonly();
  readonly activeMessages = this.messagesSignal.asReadonly();
  readonly activeSession = computed(() => this.sessionsSignal().find(s => s.sessionId === this.activeIdSignal()) || null);
  readonly totalUnread = computed(() => this.sessionsSignal().reduce((sum, s) => sum + s.unread, 0));

  connect(): void {
    if (this.socket) return;
    this.socket = io(environment.socketUrl);
    this.socket.on('connect', () => this.socket?.emit('chat:staff-join', this.adminAuth.adminId));
    this.socket.on('chat:message', (message: ChatMessage) => this.onMessage(message));
    this.refreshSessions();
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  refreshSessions(): void {
    this.http.get<{ success: boolean; sessions: ChatSession[] }>(`${BASE}/admin/sessions`, {
      params: { adminId: this.adminAuth.adminId },
    }).subscribe({
      next: (res) => {
        if (res.success) this.sessionsSignal.set(res.sessions);
      },
      error: (err) => console.warn('Failed to load chat sessions', err),
    });
  }

  openSession(sessionId: string): void {
    this.activeIdSignal.set(sessionId);
    this.messagesSignal.set([]);
    this.http.get<{ success: boolean; messages: ChatMessage[] }>(`${BASE}/${sessionId}/messages`).subscribe({
      next: (res) => {
        if (res.success && this.activeIdSignal() === sessionId) this.messagesSignal.set(res.messages);
      },
    });
    this.markRead(sessionId);
  }

  closeSession(): void {
    this.activeIdSignal.set(null);
    this.messagesSignal.set([]);
  }

  send(text: string): void {
    const sessionId = this.activeIdSignal();
    const clean = text.trim();
    if (!sessionId || !clean) return;
    this.socket?.emit('chat:message', { sessionId, text: clean, adminId: this.adminAuth.adminId });
  }

  private markRead(sessionId: string): void {
    this.sessionsSignal.update(list => list.map(s => s.sessionId === sessionId ? { ...s, unread: 0 } : s));
    this.http.post(`${BASE}/admin/sessions/${sessionId}/read`, { adminId: this.adminAuth.adminId }).subscribe();
  }

  /** Tin mới (của khách hoặc nhân viên khác): cập nhật hội thoại đang mở và đưa cuộc chat lên đầu danh sách. */
  private onMessage(message: ChatMessage): void {
    const isActive = this.activeIdSignal() === message.sessionId;
    if (isActive) {
      this.messagesSignal.update(list => (message._id && list.some(m => m._id === message._id) ? list : [...list, message]));
      if (message.sender === 'customer') this.markRead(message.sessionId);
    }

    this.sessionsSignal.update(list => {
      const existing = list.find(s => s.sessionId === message.sessionId);
      const updated: ChatSession = {
        sessionId: message.sessionId,
        lastText: message.text,
        lastSender: message.sender,
        lastAt: message.createdAt || new Date().toISOString(),
        startedAt: existing?.startedAt || message.createdAt || new Date().toISOString(),
        messageCount: (existing?.messageCount || 0) + 1,
        unread: (existing?.unread || 0) + (message.sender === 'customer' && !isActive ? 1 : 0),
        userId: existing?.userId || message.userId || null,
        customerName: existing?.customerName || message.customerName || null,
        customerPhone: existing?.customerPhone || message.customerPhone || null,
      };
      return [updated, ...list.filter(s => s.sessionId !== message.sessionId)];
    });
  }
}
