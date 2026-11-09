import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Attachment } from './document.service';

const BASE = `${environment.apiUrl}/workshop-contacts`;

export type ContactChannel = 'PHONE' | 'ZALO' | 'EMAIL' | 'MEETING' | 'OTHER';

export const CONTACT_CHANNELS: { key: ContactChannel; label: string; icon: string }[] = [
  { key: 'PHONE', label: 'Gọi điện', icon: 'bi-telephone' },
  { key: 'ZALO', label: 'Zalo', icon: 'bi-chat-dots' },
  { key: 'EMAIL', label: 'Email', icon: 'bi-envelope' },
  { key: 'MEETING', label: 'Gặp trực tiếp', icon: 'bi-people' },
  { key: 'OTHER', label: 'Khác', icon: 'bi-three-dots' },
];

/** 1 lần trao đổi với xưởng (ai liên hệ, kênh nào, nội dung gì). */
export interface WorkshopContact {
  _id: string;
  workshopId: string;
  channel: ContactChannel;
  note: string;
  attachments: Attachment[];
  by: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class WorkshopContactService {
  private http = inject(HttpClient);

  readonly contacts = signal<WorkshopContact[]>([]);

  load(workshopId: string): void {
    this.contacts.set([]);
    this.http.get<{ success: boolean; contacts: WorkshopContact[] }>(BASE, { params: { workshopId } }).subscribe({
      next: res => this.contacts.set(res.contacts || []),
      error: () => this.contacts.set([]),
    });
  }

  add(input: { workshopId: string; channel: ContactChannel; note: string; attachments: Attachment[] }): Observable<WorkshopContact> {
    return this.http.post<{ success: boolean; contact: WorkshopContact }>(BASE, input).pipe(
      map(res => res.contact),
      tap(c => this.contacts.update(list => [c, ...list])),
    );
  }
}
