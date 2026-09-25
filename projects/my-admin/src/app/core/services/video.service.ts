import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { Video } from '../models/video.model';
import { AdminAuthService } from './admin-auth.service';
import { environment } from '../../../environments/environment';

const BASE = `${environment.apiUrl}/videos`;

export type VideoInput = Partial<Omit<Video, 'id' | 'createdAt'>>;

/** Video chủ đề ở trang chủ my-client — chỉ nhân viên được đăng/sửa. */
@Injectable({
  providedIn: 'root'
})
export class VideoService {
  private http = inject(HttpClient);
  private adminAuth = inject(AdminAuthService);

  private videosSignal = signal<Video[]>([]);
  readonly videos = this.videosSignal.asReadonly();

  refresh(): void {
    this.http.get<{ success: boolean; videos: Video[] }>(`${BASE}/admin`, {
      params: { adminId: this.adminAuth.adminId },
    }).subscribe({
      next: (res) => {
        if (res.success) this.videosSignal.set(res.videos);
      },
      error: (err) => console.warn('Failed to load videos', err),
    });
  }

  create(data: VideoInput): Observable<Video> {
    return this.http.post<{ success: boolean; video: Video }>(BASE, { ...data, adminId: this.adminAuth.adminId }).pipe(
      map(res => res.video),
      tap(video => this.videosSignal.update(list => [...list, video]))
    );
  }

  update(id: string, data: VideoInput): Observable<Video> {
    return this.http.put<{ success: boolean; video: Video }>(`${BASE}/${id}`, { ...data, adminId: this.adminAuth.adminId }).pipe(
      map(res => res.video),
      tap(video => this.videosSignal.update(list => list.map(v => v.id === id ? video : v)))
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<{ success: boolean }>(`${BASE}/${id}`, {
      body: { adminId: this.adminAuth.adminId },
    }).pipe(
      map(() => undefined),
      tap(() => this.videosSignal.update(list => list.filter(v => v.id !== id)))
    );
  }
}
