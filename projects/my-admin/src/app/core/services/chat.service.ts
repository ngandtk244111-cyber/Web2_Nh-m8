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

  /** sessionId của các khách đang mở khung chat trên cửa hàng — chấm xanh trong hộp thư. */
  private onlineSignal = signal<Set<string>>(new Set());
  /** sessionId của các khách đang gõ — hiện ba chấm. */
  private typingSignal = signal<Set<string>>(new Set());
  readonly activeTyping = computed(() => {
    const id = this.activeIdSignal();
    return !!id && this.typingSignal().has(id);
  });

  private typingSentFor: string | null = null;
  private typingStopTimer: ReturnType<typeof setTimeout> | null = null;
  private customerTypingTimers = new Map<string, ReturnType<typeof setTimeout>>();

  connect(): void {
    if (this.socket) return;
    this.socket = io(environment.socketUrl);
    this.socket.on('connect', () => this.socket?.emit('chat:staff-join', this.adminAuth.adminId));
    this.socket.on('disconnect', () => {
      this.onlineSignal.set(new Set());
      this.typingSignal.set(new Set());
    });
    this.socket.on('chat:message', (message: ChatMessage) => this.onMessage(message));
    this.socket.on('chat:presence-list', ({ sessionIds }: { sessionIds: string[] }) => this.onlineSignal.set(new Set(sessionIds)));
    this.socket.on('chat:presence', ({ sessionId, online }: { sessionId: string; online: boolean }) => {
      this.onlineSignal.update(set => this.toggleIn(set, sessionId, online));
    });
    this.socket.on('chat:typing', ({ sessionId, typing }: { sessionId: string; typing: boolean }) => this.setCustomerTyping(sessionId, typing));
    this.refreshSessions();
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  isOnline(sessionId: string): boolean {
    return this.onlineSignal().has(sessionId);
  }

  isTyping(sessionId: string): boolean {
    return this.typingSignal().has(sessionId);
  }

  /** Gọi mỗi khi nhân viên gõ trong ô trả lời: báo khách 1 lần, tự báo dừng sau 2.5s không gõ. */
  notifyTyping(): void {
    const sessionId = this.activeIdSignal();
    if (!sessionId || !this.socket) return;
    if (this.typingSentFor !== sessionId) {
      this.stopTyping();
      this.typingSentFor = sessionId;
      this.socket.emit('chat:typing', { sessionId, typing: true });
    }
    if (this.typingStopTimer) clearTimeout(this.typingStopTimer);
    this.typingStopTimer = setTimeout(() => this.stopTyping(), 2500);
  }

  private stopTyping(): void {
    if (this.typingStopTimer) clearTimeout(this.typingStopTimer);
    this.typingStopTimer = null;
    if (!this.typingSentFor) return;
    this.socket?.emit('chat:typing', { sessionId: this.typingSentFor, typing: false });
    this.typingSentFor = null;
  }

  /** Tự tắt ba chấm sau 6s nếu không nhận được tín hiệu dừng. */
  private setCustomerTyping(sessionId: string, typing: boolean): void {
    const prev = this.customerTypingTimers.get(sessionId);
    if (prev) clearTimeout(prev);
    this.customerTypingTimers.delete(sessionId);
    if (typing) this.customerTypingTimers.set(sessionId, setTimeout(() => this.setCustomerTyping(sessionId, false), 6000));
    this.typingSignal.update(set => this.toggleIn(set, sessionId, typing));
  }

  private toggleIn(set: Set<string>, id: string, on: boolean): Set<string> {
    if (set.has(id) === on) return set;
    const next = new Set(set);
    if (on) next.add(id);
    else next.delete(id);
    return next;
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
    if (sessionId !== this.activeIdSignal()) this.stopTyping();
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
    this.stopTyping();
    this.activeIdSignal.set(null);
    this.messagesSignal.set([]);
  }

  send(text: string): void {
    const sessionId = this.activeIdSignal();
    const clean = text.trim();
    if (!sessionId || !clean) return;
    this.stopTyping();
    this.socket?.emit('chat:message', { sessionId, text: clean, adminId: this.adminAuth.adminId });
  }

  private markRead(sessionId: string): void {
    this.sessionsSignal.update(list => list.map(s => s.sessionId === sessionId ? { ...s, unread: 0 } : s));
    this.http.post(`${BASE}/admin/sessions/${sessionId}/read`, { adminId: this.adminAuth.adminId }).subscribe();
  }

  /** Tin mới (của khách hoặc nhân viên khác): cập nhật hội thoại đang mở và đưa cuộc chat lên đầu danh sách. */
  private onMessage(message: ChatMessage): void {
    if (message.sender === 'customer') this.setCustomerTyping(message.sessionId, false);
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
