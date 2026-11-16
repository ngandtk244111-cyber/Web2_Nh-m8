import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';
import { ProductReview } from '../models/product.model';

const BASE = `${environment.apiUrl}/products`;

/** Đánh giá của khách (do chính khách viết) — có thêm số đơn + thời điểm sửa. */
export interface MyReview extends ProductReview {
  orderNumber?: string | null;
  createdAt?: string;
  editedAt?: string;
}

/** 1 món trong đơn đã giao — dòng ở trang "Đánh giá" của tài khoản. */
export interface ReviewableItem {
  orderNumber: string;
  date: string;
  productId: string;
  name: string;
  slug: string;
  image: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  review?: MyReview;
}

/** Trang "Đánh giá" trong tài khoản: món chờ đánh giá / đã đánh giá, gửi + sửa đánh giá, tải ảnh. */
@Injectable({ providedIn: 'root' })
export class ReviewService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  myReviews(userId: string): Observable<{ success: boolean; pending: ReviewableItem[]; reviewed: ReviewableItem[] }> {
    return this.http.get<{ success: boolean; pending: ReviewableItem[]; reviewed: ReviewableItem[] }>(
      `${BASE}/my-reviews`, { params: { userId } }
    ).pipe(map(res => ({ ...res, reviewed: res.reviewed.map(item => ({
      ...item, review: item.review ? { ...item.review,
        images: item.review.images?.map(url => this.auth.getAvatarUrl(url) || url),
        video: this.auth.getAvatarUrl(item.review.video) || '',
      } : undefined,
    })) })));
  }

  uploadImages(userId: string, files: File[], video?: File): Observable<{ success: boolean; urls: string[]; video: string }> {
    const form = new FormData();
    form.append('userId', userId);
    for (const f of files) form.append('images', f);
    if (video) form.append('video', video);
    return this.http.post<{ success: boolean; urls: string[]; video: string }>(`${BASE}/review-images`, form);
  }

  submit(productId: string, payload: {
    userId: string; orderNumber: string; rating: number; comment: string; images: string[]; video: string; anonymous: boolean;
  }): Observable<{ success: boolean; review: MyReview }> {
    return this.http.post<{ success: boolean; review: MyReview }>(`${BASE}/${productId}/reviews`, payload);
  }

  update(productId: string, reviewId: string, payload: {
    userId: string; rating: number; comment: string; images: string[]; video: string; anonymous: boolean;
  }): Observable<{ success: boolean; review: MyReview }> {
    return this.http.put<{ success: boolean; review: MyReview }>(`${BASE}/${productId}/reviews/${reviewId}`, payload);
  }
}
