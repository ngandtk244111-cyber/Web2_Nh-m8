import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { CustomRequest, CustomRequestStatus } from '../models/custom-request.model';
import { CartService } from './cart.service';
import { Product } from '../models/product.model';
import { environment } from '../../../environments/environment';

const BASE = `${environment.apiUrl}/custom-requests`;

@Injectable({
  providedIn: 'root'
})
export class CustomRequestService {
  private http = inject(HttpClient);

  private requestsSignal = signal<CustomRequest[]>([]);
  readonly requests = this.requestsSignal.asReadonly();

  constructor(private cartService: CartService) {
    this.refresh();
  }

  refresh(): void {
    this.http.get<{ success: boolean; requests: CustomRequest[] }>(BASE).subscribe({
      next: (res) => {
        if (res.success) this.requestsSignal.set(res.requests);
      },
      error: (err) => console.warn('Failed to load custom requests', err),
    });
  }

  getRequestById(id: string): CustomRequest | undefined {
    return this.requestsSignal().find(r => r.id === id || r.requestCode === id);
  }

  createRequest(data: Omit<CustomRequest, 'id' | 'requestCode' | 'createdAt' | 'updatedAt' | 'messages' | 'status'>): Observable<CustomRequest> {
    return this.http.post<{ success: boolean; request: CustomRequest }>(BASE, data).pipe(
      map(res => res.request),
      tap(newRequest => this.requestsSignal.update(list => [newRequest, ...list]))
    );
  }

  sendMessage(requestId: string, text: string, sender: 'CUSTOMER' | 'SHOP_SPECIALIST' = 'CUSTOMER'): void {
    this.http.post<{ success: boolean; request: CustomRequest }>(`${BASE}/${requestId}/messages`, { text, sender }).subscribe({
      next: (res) => {
        if (res.success) this.requestsSignal.update(list => list.map(r => r.id === requestId ? res.request : r));
      },
    });
  }

  updateStatus(requestId: string, status: CustomRequestStatus, quotationPrice?: number, estimatedDays?: number, preview3dModelType?: any): void {
    this.http.patch<{ success: boolean; request: CustomRequest }>(`${BASE}/${requestId}/status`, {
      status, quotationPrice, estimatedDays, preview3dModelType,
    }).subscribe({
      next: (res) => {
        if (res.success) this.requestsSignal.update(list => list.map(r => r.id === requestId ? res.request : r));
      },
    });
  }

  convertRequestToCart(request: CustomRequest): void {
    if (!request.quotationPrice) return;

    // Create a virtual custom product and put into cart
    const customProduct: Product = {
      id: 'custom-' + request.id,
      name: `[Custom POD] ${request.title}`,
      slug: 'custom-' + request.id,
      category: 'lamp',
      categoryName: request.brief.productType || 'Sản Phẩm Thiết Kế Riêng',
      categoryGroup: 'FURNITURE',
      productionType: 'PRINT_ON_DEMAND',
      customizable: true,
      basePrice: request.quotationPrice,
      description: `Đơn đặt hàng thiết kế riêng mã ${request.requestCode}. Quy cách: ${request.brief.theme}, ${request.brief.style}, Kích thước: ${request.brief.size}, Màu: ${request.brief.color}. Khắc chữ: ${request.brief.customText || 'Không'}.`,
      rating: 5.0,
      reviewCount: 1,
      inStock: 1,
      images: [
        request.aiConceptImage || request.customerImages[0] || 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=800&q=80'
      ],
      badge: 'Thiết Kế Riêng',
      dimensions: request.brief.size || 'Theo thỏa thuận',
      materialInfo: 'Nhựa sinh học in 3D theo thiết kế kỹ thuật',
      weight: 'Theo thực tế',
      features: ['Sản xuất độc bản 1 chiếc duy nhất', 'Hỗ trợ bảo hành kỹ thuật 12 tháng'],
      reviews: [],
    };

    this.cartService.addToCart(customProduct, 1);
    if (request.status !== 'APPROVED' && request.status !== 'CONVERTED_TO_ORDER') {
      this.updateStatus(request.id, 'APPROVED');
    }
  }

  markRequestConvertedToOrder(requestId: string): void {
    this.updateStatus(requestId, 'CONVERTED_TO_ORDER');
  }
}
