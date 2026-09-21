import { Component, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CustomRequestService } from '../../../core/services/custom-request.service';
import { CartService } from '../../../core/services/cart.service';
import { CustomRequest } from '../../../core/models/custom-request.model';
import { ThreeViewerComponent } from '../../../components/three-viewer/three-viewer.component';
import { AppIconComponent } from '../../../components/icon/icon.component';
import { VndPipe } from '../../../shared/pipes/vnd.pipe';

@Component({
  selector: 'app-custom-request-detail',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    RouterLink, 
    ThreeViewerComponent, 
    AppIconComponent, 
    VndPipe
  ],
  templateUrl: './custom-request-detail.component.html',
  styleUrl: './custom-request-detail.component.css'
})
export class CustomRequestDetailComponent implements OnInit {
  request: CustomRequest | undefined;
  chatInput = '';
  private currentId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private customRequestService: CustomRequestService,
    private cartService: CartService,
    private router: Router
  ) {
    // requests giờ nạp/cập nhật bất đồng bộ từ backend — effect() tự đồng bộ this.request
    // lại mỗi khi signal đổi (kể cả sau khi gửi tin nhắn/duyệt giá qua API).
    effect(() => {
      this.customRequestService.requests();
      if (this.currentId) {
        this.request = this.customRequestService.getRequestById(this.currentId);
      }
    });
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.currentId = params.get('id');
      if (this.currentId) {
        this.request = this.customRequestService.getRequestById(this.currentId);
      }
    });
  }

  sendChatMessage(): void {
    if (!this.request || !this.chatInput.trim()) return;
    const text = this.chatInput.trim();
    this.customRequestService.sendMessage(this.request.id, text, 'CUSTOMER');
    this.chatInput = '';

    // Mock automatic reply from technician
    setTimeout(() => {
      if (this.request) {
        this.customRequestService.sendMessage(
          this.request.id,
          'Cảm ơn bạn! Kỹ thuật viên Luméa đã ghi nhận thông tin và sẽ điều chỉnh ngay.',
          'SHOP_SPECIALIST'
        );
      }
    }, 1200);
  }

  approveAndAddToCart(): void {
    if (!this.request) return;
    this.customRequestService.convertRequestToCart(this.request);
  }

  requestRevision(): void {
    if (!this.request) return;
    this.customRequestService.sendMessage(
      this.request.id,
      'Tôi muốn điều chỉnh một chút về kích thước và chi tiết khắc chữ trước khi duyệt, shop hỗ trợ giúp nhé!',
      'CUSTOMER'
    );
  }
}
