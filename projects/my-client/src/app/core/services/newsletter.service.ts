import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

const BASE = `${environment.apiUrl}/newsletter`;

@Injectable({ providedIn: 'root' })
export class NewsletterService {
  private http = inject(HttpClient);

  subscribe(email: string, userId?: string): Observable<{ success: boolean; alreadySubscribed?: boolean; error?: string }> {
    return this.http.post<{ success: boolean; alreadySubscribed?: boolean; error?: string }>(`${BASE}/subscribe`, { email, userId });
  }
}
