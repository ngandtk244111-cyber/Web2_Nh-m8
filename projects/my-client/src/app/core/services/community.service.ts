import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap, switchMap } from 'rxjs';
import { LoginModalService } from './login-modal.service';
import { ToastService } from './toast.service';
import { UserDataService } from './user-data.service';
import { AuthService } from './auth.service';
import { CommunityPost } from '../models/community.model';
import { environment } from '../../../environments/environment';

const BASE = `${environment.apiUrl}/community`;
// Trạng thái thích/lưu lấy theo tài khoản từ backend.
@Injectable({
  providedIn: 'root'
})
export class CommunityService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private userData = inject(UserDataService);
  private login = inject(LoginModalService);
  private toast = inject(ToastService);
  private refreshId = 0;
  private busy = new Set<string>();

  private postsSignal = signal<CommunityPost[]>([]);
  readonly posts = this.postsSignal.asReadonly();

  constructor() { this.refresh(); }

  private mediaUrl(url?: string): string {
    if (!url) return '';
    // Uploads use the API host, including older posts saved with a localhost URL.
    const uploadPath = url.match(/^(?:https?:\/\/[^/]+)?(\/uploads\/.*)$/)?.[1];
    return url.startsWith('/assets/') ? url : this.auth.getAvatarUrl(uploadPath || url) || '';
  }

  private normalizePosts(posts: CommunityPost[]): CommunityPost[] {
    return posts.map(p => ({
      ...p,
      imageUrl: this.mediaUrl(p.imageUrl),
      author: { ...p.author, avatar: this.mediaUrl(p.author.avatar) || '/assets/logo/lumea-mark.png' },
      comments: (p.comments || []).map(c => ({ ...c, createdAt: !isNaN(Date.parse(c.createdAt)) ? c.createdAt : /^c-\d{13}$/.test(c.id) ? new Date(Number(c.id.slice(2))).toISOString() : c.createdAt, authorAvatar: this.mediaUrl(c.authorAvatar?.includes('photo-1535713875002') && !c.userId ? '' : c.authorAvatar) || '/assets/logo/lumea-mark.png' })),
      isLiked: p.isLiked ?? false,
      isSaved: p.isSaved ?? false,
    }));
  }

  refresh(mine = false): void {
    const requestId = ++this.refreshId;
    const userId = this.auth.currentUser()?._id;
    this.userData.importSocial().pipe(switchMap(() => this.http.get<{ success: boolean; posts: CommunityPost[] }>(BASE, { params: { mine } }))).subscribe({
      next: (res) => {
        if (requestId !== this.refreshId || userId !== this.auth.currentUser()?._id) return;
        if (res.success) this.postsSignal.set(this.normalizePosts(res.posts));
      },
      error: (err) => console.warn('Failed to load community posts', err),
    });
  }

  toggleLike(postId: string): void {
    if (!this.auth.currentUser()) { this.login.open(); return; }
    if (this.busy.has(postId)) return;
    this.busy.add(postId);
    const userId = this.auth.currentUser()?._id;
    const action = this.postsSignal().find(p => p.id === postId)?.isLiked ? 'unlike' : 'like';
    this.http.post<{ post: CommunityPost }>(`${BASE}/${postId}/${action}`, {}).subscribe({
      next: res => { this.busy.delete(postId); if (userId === this.auth.currentUser()?._id) this.replacePost(res.post); },
      error: () => { this.busy.delete(postId); this.toast.error('Không cập nhật được lượt thích'); },
    });
  }

  private replacePost(post: CommunityPost): void {
    this.postsSignal.update(list => list.map(p => p.id === post.id ? this.normalizePosts([{ ...p, ...post }])[0] : p));
  }

  updatePost(id: string, data: Partial<CommunityPost>): Observable<CommunityPost> {
    return this.http.patch<{ post: CommunityPost }>(`${BASE}/${id}`, data).pipe(map(res => res.post), tap(post => this.replacePost(post)));
  }

  deletePost(id: string): Observable<unknown> {
    return this.http.delete(`${BASE}/${id}/mine`).pipe(tap(() => this.postsSignal.update(list => list.filter(p => p.id !== id))));
  }

  toggleSave(postId: string): void {
    if (!this.auth.currentUser()) { this.login.open(); return; }
    const userId = this.auth.currentUser()?._id;
    const saved = !this.postsSignal().find(p => p.id === postId)?.isSaved;
    this.http.post<{ isSaved: boolean }>(`${BASE}/${postId}/save`, { saved }).subscribe({
      next: res => { if (userId === this.auth.currentUser()?._id) this.postsSignal.update(list => list.map(p => p.id === postId ? { ...p, isSaved: res.isSaved } : p)); },
      error: () => this.toast.error('Không lưu được bài viết'),
    });
  }

  addComment(postId: string, text: string, parentId?: string): Observable<CommunityPost> {
    return this.http.post<{ success: boolean; post: CommunityPost }>(`${BASE}/${postId}/comments`, { text, parentId }).pipe(
      map(res => res.post),
      tap(post => this.replacePost(post))
    );
  }

  /**
   * Trả Observable để trang gọi tự báo kết quả: server chặn bài vi phạm tiêu chuẩn cộng đồng
   * bằng HTTP 422 kèm lý do (err.error.error) — bài đó không được thêm vào feed.
   */
  /** Tải ảnh bài đăng từ máy lên server -> trả về đường dẫn ảnh MongoDB /api/products/images/... */
  uploadImage(userId: string, file: File): Observable<{ success: boolean; url: string }> {
    const form = new FormData();
    form.append('userId', userId);
    form.append('image', file);
    return this.http.post<{ success: boolean; url: string }>(`${BASE}/upload-image`, form);
  }

  createPost(data: Omit<CommunityPost, 'id' | 'likesCount' | 'commentsCount' | 'comments' | 'createdAt'> & { userId?: string }): Observable<CommunityPost> {
    return this.http.post<{ success: boolean; post: CommunityPost }>(BASE, data).pipe(
      map(res => res.post),
      tap(post => this.postsSignal.update(list => [this.normalizePosts([post])[0], ...list]))
    );
  }
}
