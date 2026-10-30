import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AppIconComponent } from '../icon/icon.component';
import { SupportChatService } from '../../core/services/support-chat.service';
import { ToastService } from '../../core/services/toast.service';
import { NewsletterService } from '../../core/services/newsletter.service';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

interface FooterLink {
  label: string;
  link?: string;
  queryParams?: Record<string, string>;
  href?: string;
}

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AppIconComponent],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.css'
})
export class FooterComponent {
  // my-admin giờ là project Angular riêng biệt (chạy port khác) — link admin phải là link ngoài.
  readonly adminAppUrl = environment.adminAppUrl;

  newsletterEmail = '';

  // Trạng thái đóng/mở từng cột dạng accordion — chỉ có tác dụng ở mobile qua CSS, desktop luôn mở.
  open: { shop: boolean; explore: boolean; support: boolean } = {
    shop: false,
    explore: false,
    support: false,
  };

  readonly shopLinks: FooterLink[] = [
    { label: 'Tất cả sản phẩm', link: '/catalog' },
    { label: 'Nội thất', link: '/catalog', queryParams: { dept: 'noi-that' } },
    { label: 'Đèn & ánh sáng', link: '/catalog', queryParams: { dept: 'anh-sang' } },
    { label: 'Decor', link: '/catalog', queryParams: { dept: 'decor' } },
    { label: 'Đồ dùng & phụ kiện', link: '/catalog', queryParams: { dept: 'do-dung' } },
    { label: 'Sản phẩm có thể tuỳ biến', link: '/catalog', queryParams: { custom: '1' } },
    { label: 'Flash Sale', link: '/flash-sale' },
  ];

  /** Tên mỗi mục trùng với tiêu đề của trang nó mở ra. */
  readonly exploreLinks: FooterLink[] = [
    { label: 'Câu chuyện Luméa', link: '/ve-lumea' },
    { label: 'Tự tay thiết kế & xem trước 3D', link: '/customizer-3d' },
    { label: 'Gửi yêu cầu thiết kế riêng', link: '/custom-request/new' },
    { label: 'Cộng đồng decor', link: '/community' },
    { label: 'Không gian 3D trực quan', link: '/shop-the-room' },
    { label: 'Tin tức & Mẹo sống', link: '/news' },
  ];

  readonly supportLinks: FooterLink[] = [
    { label: 'Đơn hàng của tôi', link: '/account', queryParams: { tab: 'orders' } },
    { label: 'Chính sách bảo hành', link: '/chinh-sach/bao-hanh' },
  ];

  constructor(
    private supportChatService: SupportChatService,
    private toastService: ToastService,
    private newsletterService: NewsletterService,
    private authService: AuthService
  ) {}

  toggle(key: 'shop' | 'explore' | 'support'): void {
    this.open[key] = !this.open[key];
  }

  openSupportCenter(): void {
    this.supportChatService.open();
  }

  subscribeNewsletter(): void {
    const email = this.newsletterEmail.trim();
    if (!email) return;
    const userId = this.authService.currentUser()?._id;

    this.newsletterService.subscribe(email, userId).subscribe({
      next: (res) => {
        if (res.success) {
          this.toastService.success(
            userId && !res.alreadySubscribed
              ? 'Cảm ơn bạn đã đăng ký! Voucher ưu đãi đã được thêm vào tài khoản của bạn.'
              : 'Cảm ơn bạn đã đăng ký! Luméa sẽ gửi cảm hứng nội thất & decor mới nhất tới email của bạn.'
          );
          this.newsletterEmail = '';
        } else {
          this.toastService.error(res.error || 'Không đăng ký được, vui lòng thử lại.');
        }
      },
      error: () => this.toastService.error('Không đăng ký được, vui lòng thử lại.'),
    });
  }
}
