import { Component, HostListener, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { ProductService } from '../../../core/services/product.service';
import { CartService } from '../../../core/services/cart.service';
import { ReviewService, ReviewableItem } from '../../../core/services/review.service';
import { AppIconComponent } from '../../../components/icon/icon.component';
import { VndPipe } from '../../../shared/pipes/vnd.pipe';

type ReviewTab = 'pending' | 'reviewed';

const MAX_IMAGES = 5;
const MAX_LENGTH = 500;
const RATING_LABELS = ['', 'Rất tệ', 'Tệ', 'Bình thường', 'Tốt', 'Rất tốt'];

/**
 * Quản lý đánh giá (tham khảo trang Quản lý đánh giá của VitaCare, bỏ phần thưởng xu):
 * "Chưa đánh giá" = món trong đơn đã giao chưa có đánh giá; "Đã đánh giá" = xem lại / sửa đánh giá.
 */
@Component({
  selector: 'app-account-reviews-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AppIconComponent, VndPipe],
  templateUrl: './reviews-tab.component.html',
  styleUrl: './reviews-tab.component.css',
})
export class ReviewsTabComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly reviewService = inject(ReviewService);
  private readonly productService = inject(ProductService);
  private readonly cartService = inject(CartService);
  private readonly router = inject(Router);

  readonly maxImages = MAX_IMAGES;
  readonly maxLength = MAX_LENGTH;
  readonly stars = [1, 2, 3, 4, 5];

  tab: ReviewTab = 'pending';
  loading = false;
  readonly search = signal('');
  private readonly pending = signal<ReviewableItem[]>([]);
  private readonly reviewed = signal<ReviewableItem[]>([]);

  readonly pendingCount = computed(() => this.pending().length);
  readonly pendingList = computed(() => this.filter(this.pending()));
  readonly reviewedList = computed(() => this.filter(this.reviewed()));

  /* ---------- Hộp đánh giá ---------- */
  editing: ReviewableItem | null = null;
  rating = 5;
  hoverRating = 0;
  comment = '';
  images: string[] = [];
  uploading = false;
  submitting = false;

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const userId = this.auth.currentUser()?._id;
    if (!userId) return;
    this.loading = true;
    this.reviewService.myReviews(userId).subscribe({
      next: res => {
        this.loading = false;
        this.pending.set(res.pending || []);
        this.reviewed.set(res.reviewed || []);
      },
      error: () => {
        this.loading = false;
        this.toast.error('Không tải được danh sách đánh giá');
      },
    });
  }

  private filter(list: ReviewableItem[]): ReviewableItem[] {
    const q = this.search().trim().toLowerCase();
    if (!q) return list;
    return list.filter(i => i.orderNumber.toLowerCase().includes(q) || i.name.toLowerCase().includes(q));
  }

  ratingLabel(n: number): string {
    return RATING_LABELS[n] || '';
  }

  /** Mua lại: sản phẩm có sẵn thêm thẳng vào giỏ, sản phẩm tuỳ biến mở trang chi tiết để chọn lại. */
  buyAgain(item: ReviewableItem): void {
    const product = this.productService.getProductById(item.productId);
    if (!product || product.customizable) {
      this.router.navigate(['/product', item.slug || item.productId]);
      return;
    }
    this.cartService.addToCart(product, 1);
  }

  openReview(item: ReviewableItem): void {
    this.editing = item;
    this.rating = item.review?.rating || 5;
    this.hoverRating = 0;
    this.comment = item.review?.comment || '';
    this.images = [...(item.review?.images || [])];
  }

  @HostListener('document:keydown.escape')
  closeReview(): void {
    if (this.submitting) return;
    this.editing = null;
  }

  onImagesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = '';
    this.addImages(files);
  }

  private addImages(files: File[]): void {
    const userId = this.auth.currentUser()?._id;
    if (!userId || !files.length) return;
    const room = MAX_IMAGES - this.images.length;
    if (room <= 0) {
      this.toast.info(`Tối đa ${MAX_IMAGES} ảnh cho mỗi đánh giá`);
      return;
    }
    const valid = files.filter(f => /^image\/(png|jpe?g|webp|gif)$/.test(f.type) && f.size <= 5 * 1024 * 1024);
    if (valid.length < files.length) this.toast.error('Chỉ nhận ảnh JPG, PNG, WEBP, GIF dưới 5MB');
    const picked = valid.slice(0, room);
    if (valid.length > room) this.toast.info(`Chỉ thêm được ${room} ảnh nữa`);
    if (!picked.length) return;

    this.uploading = true;
    this.reviewService.uploadImages(userId, picked).subscribe({
      next: res => {
        this.uploading = false;
        const urls = res.urls.map(u => this.auth.getAvatarUrl(u) || u);
        this.images = [...this.images, ...urls].slice(0, MAX_IMAGES);
      },
      error: err => {
        this.uploading = false;
        this.toast.error(err?.error?.error || 'Không tải được ảnh, vui lòng thử lại');
      },
    });
  }

  removeImage(i: number): void {
    this.images = this.images.filter((_, idx) => idx !== i);
  }

  submit(): void {
    const item = this.editing;
    const user = this.auth.currentUser();
    if (!item || !user) return;
    const comment = this.comment.trim();
    if (!comment) {
      this.toast.error('Vui lòng nhập nội dung đánh giá');
      return;
    }
    this.submitting = true;
    const done = (message: string) => {
      this.submitting = false;
      this.editing = null;
      this.toast.success(message);
      this.load();
      this.productService.refresh();
    };
    const fail = (err: { error?: { error?: string } }) => {
      this.submitting = false;
      this.toast.error(err?.error?.error || 'Không gửi được đánh giá, vui lòng thử lại', 6000);
    };

    if (item.review) {
      this.reviewService.update(item.productId, item.review.id, {
        userId: user._id, rating: this.rating, comment, images: this.images,
      }).subscribe({ next: () => done('Đã cập nhật đánh giá'), error: fail });
    } else {
      this.reviewService.submit(item.productId, {
        userId: user._id,
        orderNumber: item.orderNumber,
        author: user.fullName || 'Khách hàng Luméa',
        avatar: this.auth.getAvatarUrl(user.avatar) || undefined,
        rating: this.rating,
        comment,
        images: this.images,
      }).subscribe({
        next: () => {
          this.tab = 'reviewed';
          done('Cảm ơn bạn đã đánh giá!');
        },
        error: fail,
      });
    }
  }
}
