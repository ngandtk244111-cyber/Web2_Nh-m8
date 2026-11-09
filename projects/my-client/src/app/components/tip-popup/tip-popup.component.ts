import { Component, HostListener, NgZone, OnDestroy, OnInit, computed, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AiAssistantService } from '../../core/services/ai-assistant.service';
import { TipPopupService } from '../../core/services/tip-popup.service';
import { AppIconComponent } from '../icon/icon.component';

/** Mở popup khi người dùng đã cuộn qua tỉ lệ này của trang — thay cho mở sau 3s, tránh chồng lên hero/banner lúc vừa vào. */
const OPEN_SCROLL_RATIO = 0.4;
const CLOSE_ANIMATION_MS = 250;

interface ServiceTip {
  title: string;
  excerpt: string;
  coverImage: string;
  /** Trang dịch vụ; null = mở trợ lý AI ngay trên trang. */
  link: string | null;
}

/** Mẹo giới thiệu các dịch vụ hữu ích của Luméa — mỗi lần vào trang chủ hiện ngẫu nhiên 1 mẹo. */
const SERVICE_TIPS: ServiceTip[] = [
  {
    title: 'Ngắm nội thất trong phòng 3D trước khi mua',
    excerpt: 'Dạo quanh căn phòng mẫu 360°, chạm vào từng số để xem giá và thêm cả bộ vào giỏ chỉ với 1 lần bấm.',
    coverImage: 'assets/hero-banner/hero-room-3d.png',
    link: '/shop-the-room',
  },
  {
    title: 'Trợ lý AI gợi ý decor miễn phí',
    excerpt: 'Kể về căn phòng và ngân sách của bạn, trợ lý AI của Luméa gợi ý phối màu và sản phẩm phù hợp trong vài giây.',
    coverImage: 'assets/hero-banner/hero-ai-assistant.png',
    link: null,
  },
  {
    title: 'Đặt in 3D đồ decor theo ý riêng',
    excerpt: 'Gửi ý tưởng hoặc ảnh tham khảo — xưởng Luméa dựng mô hình, chọn vật liệu, in và khắc tên theo yêu cầu.',
    coverImage: 'assets/hero-banner/hero-print-3d.png',
    link: '/custom-request',
  },
  {
    title: 'Nhà bạn hợp phong cách nào?',
    excerpt: 'Trả lời vài câu hỏi nhanh để biết gu nội thất của bạn, nhận gợi ý sản phẩm hợp phong cách kèm voucher.',
    coverImage: 'assets/promo-banner/style-quiz-bedroom.jpg',
    link: '/style-quiz',
  },
  {
    title: 'Bảo hành 12 tháng, tra cứu online',
    excerpt: 'Mỗi sản phẩm có mã bảo hành riêng ngay khi giao thành công. Tra cứu tình trạng bảo hành bất cứ lúc nào.',
    coverImage: 'assets/hero-banner/hero-deal-today.png',
    link: '/warranty-lookup',
  },
];

@Component({
  selector: 'app-tip-popup',
  standalone: true,
  imports: [CommonModule, AppIconComponent],
  templateUrl: './tip-popup.component.html',
  styleUrl: './tip-popup.component.css'
})
export class TipPopupComponent implements OnInit, OnDestroy {
  private readonly scrolledEnough = signal(false);
  readonly closing = signal(false);

  private closeTimer: ReturnType<typeof setTimeout> | null = null;

  readonly article = signal(SERVICE_TIPS[Math.floor(Math.random() * SERVICE_TIPS.length)]);
  readonly visible;

  constructor(
    private aiService: AiAssistantService,
    private tipPopupService: TipPopupService,
    private router: Router,
    private zone: NgZone
  ) {
    this.visible = computed(() =>
      this.scrolledEnough() && !this.tipPopupService.dismissed()
    );

    effect(() => {
      document.body.style.overflow = this.visible() ? 'hidden' : '';
    });
  }

  // Nghe scroll ngoài Angular zone để không chạy change detection mỗi lần cuộn; chỉ vào zone khi cần mở.
  private readonly onScroll = () => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollable <= 0 || window.scrollY / scrollable < OPEN_SCROLL_RATIO) return;
    this.stopListening();
    this.zone.run(() => this.scrolledEnough.set(true));
  };

  ngOnInit(): void {
    this.zone.runOutsideAngular(() => window.addEventListener('scroll', this.onScroll, { passive: true }));
  }

  private stopListening(): void {
    window.removeEventListener('scroll', this.onScroll);
  }

  ngOnDestroy(): void {
    this.stopListening();
    if (this.closeTimer) clearTimeout(this.closeTimer);
    document.body.style.overflow = '';
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.visible()) this.close();
  }

  close(): void {
    if (this.closing()) return;
    this.closing.set(true);
    this.closeTimer = setTimeout(() => {
      this.tipPopupService.dismiss();
      this.closing.set(false);
      document.body.style.overflow = '';
    }, CLOSE_ANIMATION_MS);
  }

  goToArticle(): void {
    const link = this.article().link;
    this.close();
    if (link) this.router.navigate([link]);
    else this.aiService.openModal();
  }
}
