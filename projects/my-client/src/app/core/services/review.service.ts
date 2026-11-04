import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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

  myReviews(userId: string): Observable<{ success: boolean; pending: ReviewableItem[]; reviewed: ReviewableItem[] }> {
    return this.http.get<{ success: boolean; pending: ReviewableItem[]; reviewed: ReviewableItem[] }>(
      `${BASE}/my-reviews`, { params: { userId } }
    );
  }

  uploadImages(userId: string, files: File[]): Observable<{ success: boolean; urls: string[] }> {
    const form = new FormData();
    form.append('userId', userId);
    for (const f of files) form.append('images', f);
    return this.http.post<{ success: boolean; urls: string[] }>(`${BASE}/review-images`, form);
  }

  submit(productId: string, payload: {
    userId: string; orderNumber: string; author: string; avatar?: string; rating: number; comment: string; images: string[];
  }): Observable<{ success: boolean; review: MyReview }> {
    return this.http.post<{ success: boolean; review: MyReview }>(`${BASE}/${productId}/reviews`, payload);
  }

  update(productId: string, reviewId: string, payload: {
    userId: string; rating: number; comment: string; images: string[];
  }): Observable<{ success: boolean; review: MyReview }> {
    return this.http.put<{ success: boolean; review: MyReview }>(`${BASE}/${productId}/reviews/${reviewId}`, payload);
  }
}
