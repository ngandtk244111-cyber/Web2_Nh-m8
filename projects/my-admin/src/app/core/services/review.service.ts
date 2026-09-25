import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { AdminAuthService } from './admin-auth.service';
import { environment } from '../../../environments/environment';

const BASE = `${environment.apiUrl}/products`;

/** Đánh giá sản phẩm của khách (lưu trong Product.reviews) kèm thông tin sản phẩm để hiển thị. */
export interface AdminReview {
  id: string;
  userId?: string | null;
  author: string;
  avatar?: string;
  rating: number;
  date: string;
  comment: string;
  verifiedPurchase: boolean;
  images?: string[];
  status: 'VISIBLE' | 'HIDDEN';
  hiddenReason?: string;
  reply?: { text: string; date: string } | null;
  pinned?: boolean;
  productId: string;
  productName: string;
  productSlug: string;
  productImage: string;
}

/**
 * Đánh giá đăng ngay không chờ duyệt — nhân viên chỉ phản hồi công khai, ghim đánh giá hay,
 * và ẩn đánh giá vi phạm.
 */
@Injectable({
  providedIn: 'root'
})
export class ReviewService {
  private http = inject(HttpClient);
  private adminAuth = inject(AdminAuthService);

  private reviewsSignal = signal<AdminReview[]>([]);
  readonly reviews = this.reviewsSignal.asReadonly();

  refresh(): void {
    this.http.get<{ success: boolean; reviews: AdminReview[] }>(`${BASE}/reviews/admin`, {
      params: { adminId: this.adminAuth.adminId },
    }).subscribe({
      next: (res) => {
        if (res.success) this.reviewsSignal.set(res.reviews);
      },
      error: (err) => console.warn('Failed to load reviews', err),
    });
  }

  update(review: AdminReview, changes: { status?: 'VISIBLE' | 'HIDDEN'; hiddenReason?: string; reply?: string; pinned?: boolean }): Observable<AdminReview> {
    return this.http.patch<{ success: boolean; review: AdminReview }>(`${BASE}/${review.productId}/reviews/${review.id}`, {
      ...changes, adminId: this.adminAuth.adminId,
    }).pipe(
      map(res => res.review),
      tap(updated => this.reviewsSignal.update(list => list.map(r => r.id === review.id && r.productId === review.productId ? updated : r)))
    );
  }
}
