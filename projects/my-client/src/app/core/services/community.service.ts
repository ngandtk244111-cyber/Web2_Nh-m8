import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommunityPost } from '../models/community.model';
import { environment } from '../../../environments/environment';

const BASE = `${environment.apiUrl}/community`;
// isLiked/isSaved là trạng thái cục bộ theo trình duyệt (app không bắt buộc đăng nhập để xem
// cộng đồng) — chỉ likesCount/commentsCount/comments là dữ liệu dùng chung lấy từ backend.
const LIKED_KEY = 'deco3d_community_liked';
const SAVED_KEY = 'deco3d_community_saved';

@Injectable({
  providedIn: 'root'
})
export class CommunityService {
  private http = inject(HttpClient);

  private postsSignal = signal<CommunityPost[]>([]);
  readonly posts = this.postsSignal.asReadonly();

  private likedIds = new Set<string>(this.loadIds(LIKED_KEY));
  private savedIds = new Set<string>(this.loadIds(SAVED_KEY));

  constructor() {
    this.refresh();
  }

  private loadIds(key: string): string[] {
    try {
      const stored = localStorage.getItem(key);
      if (stored) return JSON.parse(stored);
    } catch { /* ignore */ }
    return [];
  }

  private persistIds(key: string, ids: Set<string>): void {
    try {
      localStorage.setItem(key, JSON.stringify([...ids]));
    } catch { /* ignore */ }
  }

  private applyLocalFlags(posts: CommunityPost[]): CommunityPost[] {
    return posts.map(p => ({
      ...p,
      isLiked: this.likedIds.has(p.id),
      isSaved: this.savedIds.has(p.id),
    }));
  }

  refresh(): void {
    this.http.get<{ success: boolean; posts: CommunityPost[] }>(BASE).subscribe({
      next: (res) => {
        if (res.success) this.postsSignal.set(this.applyLocalFlags(res.posts));
      },
      error: (err) => console.warn('Failed to load community posts', err),
    });
  }

  toggleLike(postId: string): void {
    const wasLiked = this.likedIds.has(postId);
    const action = wasLiked ? 'unlike' : 'like';

    this.http.post<{ success: boolean; post: CommunityPost }>(`${BASE}/${postId}/${action}`, {}).subscribe({
      next: (res) => {
        if (!res.success) return;
        if (wasLiked) this.likedIds.delete(postId); else this.likedIds.add(postId);
        this.persistIds(LIKED_KEY, this.likedIds);
        this.postsSignal.update(list =>
          list.map(p => p.id === postId ? { ...res.post, isLiked: !wasLiked, isSaved: p.isSaved } : p)
        );
      },
    });
  }

  toggleSave(postId: string): void {
    if (this.savedIds.has(postId)) this.savedIds.delete(postId);
    else this.savedIds.add(postId);
    this.persistIds(SAVED_KEY, this.savedIds);
    this.postsSignal.update(list =>
      list.map(p => p.id === postId ? { ...p, isSaved: this.savedIds.has(postId) } : p)
    );
  }

  addComment(postId: string, text: string, authorName = 'Bạn'): void {
    this.http.post<{ success: boolean; post: CommunityPost }>(`${BASE}/${postId}/comments`, { text, authorName }).subscribe({
      next: (res) => {
        if (!res.success) return;
        this.postsSignal.update(list =>
          list.map(p => p.id === postId ? { ...res.post, isLiked: p.isLiked, isSaved: p.isSaved } : p)
        );
      },
    });
  }

  createPost(data: Omit<CommunityPost, 'id' | 'likesCount' | 'commentsCount' | 'comments' | 'createdAt'> & { userId?: string }): void {
    this.http.post<{ success: boolean; post: CommunityPost }>(BASE, data).subscribe({
      next: (res) => {
        if (res.success) this.postsSignal.update(list => [this.applyLocalFlags([res.post])[0], ...list]);
      },
    });
  }
}
