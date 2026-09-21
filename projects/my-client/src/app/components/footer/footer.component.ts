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
    { label: 'Decor bàn làm việc', link: '/catalog', queryParams: { category: 'organizer' } },
    { label: 'Decor phòng ngủ', link: '/catalog', queryParams: { category: 'lamp' } },
    { label: 'Decor phòng khách', link: '/catalog', queryParams: { category: 'bookshelf' } },
    { label: 'Đèn & phụ kiện decor', link: '/catalog', queryParams: { category: 'lamp' } },
    { label: 'Tượng & mô hình', link: '/catalog', queryParams: { category: 'sculpture' } },
    { label: 'Kệ & đồ trang trí', link: '/catalog', queryParams: { category: 'tray' } },
    { label: 'Sản phẩm mới', link: '/catalog' },
  ];

  readonly exploreLinks: FooterLink[] = [
    { label: '3D Studio', link: '/customizer-3d' },
    { label: 'Tạo sản phẩm riêng', link: '/custom-request/new' },
    { label: 'Decor Community', link: '/community' },
    { label: 'Cảm hứng decor', link: '/shop-the-room' },
    { label: 'Tin tức & xu hướng', link: '/news' },
    { label: 'Sản phẩm nổi bật', link: '/catalog' },
  ];

  readonly supportLinks: FooterLink[] = [
    { label: 'Theo dõi đơn hàng', link: '/orders/track' },
    { label: 'Chính sách bảo hành', link: '/warranty-lookup' },
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
              ? 'Cảm ơn bạn đã đăng ký! Bạn vừa nhận thêm Xu Luméa.'
              : 'Cảm ơn bạn đã đăng ký! Mini 3D Studio sẽ gửi cảm hứng decor mới nhất tới email của bạn.'
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
