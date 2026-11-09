import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Product } from '../models/product.model';

const BASE = `${environment.apiUrl}/workshop-receipts`;

/** 1 lần xưởng giao hàng thành phẩm, Luméa nhập kho. */
export interface WorkshopReceipt {
  _id: string;
  workshopId: string;
  workshopName: string;
  productId: string;
  productName: string;
  qty: number;
  stockAfter: number | null;
  note: string;
  by: string;
  createdAt: string;
}

/** Lịch sử giao nhận với xưởng (500 lần gần nhất), thêm dòng mới ngay khi nhập kho thành công. */
@Injectable({ providedIn: 'root' })
export class WorkshopReceiptService {
  private http = inject(HttpClient);

  readonly receipts = signal<WorkshopReceipt[]>([]);
  readonly loaded = signal(false);

  refresh(): void {
    this.http.get<{ success: boolean; receipts: WorkshopReceipt[] }>(BASE).subscribe({
      next: res => {
        this.receipts.set(res.receipts || []);
        this.loaded.set(true);
      },
      error: () => this.loaded.set(true),
    });
  }

  /** Nhập kho từ xưởng: server cộng tồn kho và ghi lịch sử; trả về sản phẩm sau khi cộng. */
  receive(input: { workshopId: string; productId: string; qty: number; note?: string }): Observable<Product> {
    return this.http.post<{ success: boolean; receipt: WorkshopReceipt; product: Product }>(BASE, input).pipe(
      tap(res => this.receipts.update(list => [res.receipt, ...list])),
      map(res => res.product),
    );
  }
}
