import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Product } from '../models/product.model';
import { Attachment } from './document.service';

const BASE = `${environment.apiUrl}/stock-adjustments`;

/** Phiếu nhập / xuất điều chỉnh tồn kho không qua xưởng (trả hàng, kiểm kê, hàng lỗi...). */
export interface StockAdjustment {
  _id: string;
  productId: string;
  productName: string;
  type: 'IN' | 'OUT';
  qty: number;
  stockAfter: number | null;
  reason: string;
  note: string;
  attachments: Attachment[];
  by: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class StockAdjustmentService {
  private http = inject(HttpClient);

  /** Server cộng / trừ tồn nguyên tử, bắt buộc lý do + ít nhất 1 chứng từ; trả sản phẩm sau điều chỉnh. */
  adjust(input: { productId: string; type: 'IN' | 'OUT'; qty: number; reason: string; note?: string; attachments: Attachment[] }): Observable<Product> {
    return this.http.post<{ success: boolean; adjustment: StockAdjustment; product: Product }>(BASE, input).pipe(map(res => res.product));
  }
}
