import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { CommunityPost, CommunityPostStatus } from '../models/community.model';
import { AdminAuthService } from './admin-auth.service';
import { environment } from '../../../environments/environment';

const BASE = `${environment.apiUrl}/community`;

/** Kiểm duyệt bài đăng Cộng đồng do khách hàng tạo ở my-client. */
@Injectable({
  providedIn: 'root'
})
export class CommunityService {
  private http = inject(HttpClient);
  private adminAuth = inject(AdminAuthService);

  private postsSignal = signal<CommunityPost[]>([]);
  readonly posts = this.postsSignal.asReadonly();

  refresh(): void {
    this.http.get<{ success: boolean; posts: CommunityPost[] }>(`${BASE}/admin`, {
      params: { adminId: this.adminAuth.adminId },
    }).subscribe({
      next: (res) => {
        if (res.success) this.postsSignal.set(res.posts);
      },
      error: (err) => console.warn('Failed to load community posts', err),
    });
  }

  /** Đổi trạng thái hiển thị (kèm lý do khi ẩn) và/hoặc nhãn Staff Pick. */
  moderate(postId: string, changes: { status?: CommunityPostStatus; reason?: string; isStaffPick?: boolean }): Observable<CommunityPost> {
    return this.http.patch<{ success: boolean; post: CommunityPost }>(`${BASE}/${postId}/moderation`, {
      ...changes, adminId: this.adminAuth.adminId,
    }).pipe(
      map(res => res.post),
      // Giữ postedAt do route admin tính sẵn (bài cũ không lưu trường này trong DB).
      tap(post => this.postsSignal.update(list => list.map(p => p.id === postId ? { ...p, ...post, postedAt: p.postedAt } : p)))
    );
  }

  delete(postId: string): Observable<void> {
    return this.http.delete<{ success: boolean }>(`${BASE}/${postId}`, {
      body: { adminId: this.adminAuth.adminId },
    }).pipe(
      map(() => undefined),
      tap(() => this.postsSignal.update(list => list.filter(p => p.id !== postId)))
    );
  }
}
