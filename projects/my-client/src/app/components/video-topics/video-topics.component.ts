import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { AppIconComponent } from '../icon/icon.component';
import { ToastService } from '../../core/services/toast.service';

export interface VideoTopic {
  title: string;
  description: string;
  link?: string;
  ctaLabel: string;
  poster: string;
  /**
   * ID video YouTube (phần sau youtube.com/watch?v=) để phát dạng reels ngang khi thẻ
   * lọt vào tầm nhìn. Để trống thì thẻ chỉ hiển thị ảnh poster tĩnh.
   */
  youtubeId?: string;
}

const TOPICS: VideoTopic[] = [
  {
    title: 'Giao Hàng Hỏa Tốc',
    description: 'Giao nội thành trong 24h, đóng gói chống va đập cẩn thận cho từng món decor.',
    link: '/orders/track',
    ctaLabel: 'Tra cứu đơn hàng',
    poster: 'https://images.unsplash.com/photo-1602874801007-bd458bb1b8b6?auto=format&fit=crop&w=800&q=70',
    youtubeId: 'OLT1QLyJc0w',
  },
  {
    title: 'Bảo Hành 12 Tháng',
    description: 'Bảo hành kỹ thuật cho mọi sản phẩm in 3D — an tâm sử dụng lâu dài.',
    link: '/warranty-lookup',
    ctaLabel: 'Tra cứu bảo hành',
    poster: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=800&q=70',
    youtubeId: 'd3x3koO73qk',
  },
  {
    title: 'Tùy Biến 3D',
    description: 'Đổi màu, chất liệu, kích thước và khắc tên riêng ngay trên trình xem 3D.',
    link: '/customizer-3d',
    ctaLabel: 'Vào trình tùy biến',
    poster: 'https://images.unsplash.com/photo-1612196808214-b8e1d6145a8c?auto=format&fit=crop&w=800&q=70',
    youtubeId: 'ITgq96NgTDY',
  },
  {
    title: 'Thiết Kế Theo Yêu Cầu',
    description: 'AI & kỹ sư tư vấn dựng concept riêng theo đúng ý tưởng của bạn.',
    link: '/custom-request',
    ctaLabel: 'Gửi yêu cầu thiết kế',
    poster: 'https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?auto=format&fit=crop&w=800&q=70',
    youtubeId: 'cN64Hm_CfI4',
  },
  {
    title: 'Xem Trước Không Gian 3D',
    description: 'Dạo quanh phòng mẫu 360° được Luméa phối sẵn trước khi quyết định mua.',
    link: '/shop-the-room',
    ctaLabel: 'Khám phá Shop The Room',
    poster: 'https://images.unsplash.com/photo-1616046229478-9901c5536a45?auto=format&fit=crop&w=800&q=70',
    youtubeId: 'WrrevTxy5P0',
  },
  {
    title: '100% Nhựa PLA Sinh Học',
    description: 'Vật liệu in 3D an toàn, thân thiện môi trường cho mọi sản phẩm Luméa.',
    ctaLabel: 'Tìm hiểu thêm',
    link: '/catalog',
    poster: 'https://images.unsplash.com/photo-1594026112284-02bb6f3352fe?auto=format&fit=crop&w=800&q=70',
    youtubeId: 'WwS7-ELNhZs',
  },
];

/** Vuốt dọc trong viewer vượt ngưỡng này (px) mới coi là chuyển video, giống vuốt reels. */
const SWIPE_THRESHOLD = 50;
/** Lăn chuột trong viewer: deltaY nhỏ hơn ngưỡng này bị bỏ qua (chuột cảm ứng/trackpad rung nhẹ). */
const WHEEL_MIN_DELTA = 12;

/** Số thẻ hiển thị cùng lúc trong carousel theo breakpoint — khớp với flex-basis đặt trong CSS. */
const DESKTOP_VISIBLE = 4;
const TABLET_VISIBLE = 2;
const MOBILE_VISIBLE = 1;
const TABLET_MIN_WIDTH = 641;
const DESKTOP_MIN_WIDTH = 1024;
/** Khoảng cách giữa các thẻ (px) — phải khớp với `gap` đặt trên .vt_track trong CSS. */
const TRACK_GAP_PX = 16;

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/** Nạp YouTube IFrame API đúng 1 lần cho cả trang, dùng chung nếu có nhiều nơi cần. */
let youtubeApiPromise: Promise<void> | null = null;
function loadYoutubeIframeApi(): Promise<void> {
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise((resolve) => {
    if (window.YT?.Player) {
      resolve();
      return;
    }
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
  });
  return youtubeApiPromise;
}

@Component({
  selector: 'app-video-topics',
  standalone: true,
  imports: [CommonModule, RouterLink, AppIconComponent],
  templateUrl: './video-topics.component.html',
  styleUrl: './video-topics.component.css'
})
export class VideoTopicsComponent implements AfterViewInit, OnDestroy {
  readonly topics = TOPICS;
  private loadedIndices = new Set<number>();
  private players = new Map<number, any>();
  /** Index của các topic có youtubeId nhưng video lỗi (không tồn tại, riêng tư, hoặc chủ sở hữu
   *  tắt nhúng) — YouTube vẫn bắn onReady cho player rỗng nên phải tự bắt onError, nếu không
   *  poster bị ẩn nhưng video không hiện gì (khung đen trống thay vì ảnh nền). */
  private erroredIndices = new Set<number>();
  /** Thẻ đang được trỏ chuột vào (desktop hover) — video phát khi hover, dừng khi rời chuột,
   *  thay cho việc dùng ảnh poster tĩnh không liên quan tới video thật. */
  hoveredIndex: number | null = null;

  @ViewChild('viewport') viewport!: ElementRef<HTMLDivElement>;
  @ViewChild('track') track!: ElementRef<HTMLDivElement>;
  @ViewChild('progressThumb') progressThumb!: ElementRef<HTMLDivElement>;
  @ViewChildren('ytTarget') ytTargets!: QueryList<ElementRef<HTMLDivElement>>;

  // ---------- Carousel phân trang — chỉ đổi khi bấm mũi tên, không auto-scroll/kéo tự do ----------
  visibleCount = DESKTOP_VISIBLE;
  /** Index của thẻ nằm ngoài cùng bên trái trong nhóm đang hiển thị. */
  pageStart = 0;

  get maxPageStart(): number {
    return Math.max(0, this.topics.length - this.visibleCount);
  }

  get canGoPrev(): boolean {
    return this.pageStart > 0;
  }

  get canGoNext(): boolean {
    return this.pageStart < this.maxPageStart;
  }

  /** Mỗi lần bấm mũi tên dịch đi nửa số thẻ đang hiển thị (tối thiểu 1) — ví dụ hiện 4 thẻ thì
   *  mỗi lần bấm dịch 2 thẻ, giữ lại 2 thẻ cũ + 2 thẻ mới để người dùng dễ theo dõi mạch nội dung. */
  private pageStep(): number {
    return Math.max(1, Math.floor(this.visibleCount / 2));
  }

  goPrev(): void {
    this.pageStart = Math.max(0, this.pageStart - this.pageStep());
    this.applyCarouselPosition();
  }

  goNext(): void {
    this.pageStart = Math.min(this.maxPageStart, this.pageStart + this.pageStep());
    this.applyCarouselPosition();
  }

  private computeVisibleCount(): number {
    const w = window.innerWidth;
    if (w >= DESKTOP_MIN_WIDTH) return DESKTOP_VISIBLE;
    if (w >= TABLET_MIN_WIDTH) return TABLET_VISIBLE;
    return MOBILE_VISIBLE;
  }

  /** Dịch chuyển track bằng transform (đo kích thước thẻ thật ngoài DOM, không suy đoán) và cập
   *  nhật thanh tiến trình — chạy trực tiếp trên DOM, không qua Angular change detection. */
  private applyCarouselPosition(): void {
    const trackEl = this.track?.nativeElement;
    if (!trackEl) return;
    const firstCard = trackEl.querySelector('.vt_card') as HTMLElement | null;
    const cardWidth = firstCard ? firstCard.getBoundingClientRect().width : 0;
    const offset = this.pageStart * (cardWidth + TRACK_GAP_PX);
    trackEl.style.transform = `translateX(-${offset}px)`;

    const thumb = this.progressThumb?.nativeElement;
    if (thumb && this.topics.length > 0) {
      const widthPct = Math.min(100, (this.visibleCount / this.topics.length) * 100);
      const progress = this.maxPageStart > 0 ? this.pageStart / this.maxPageStart : 0;
      thumb.style.width = `${widthPct}%`;
      thumb.style.left = `${progress * (100 - widthPct)}%`;
    }
  }

  private resizeTimer: ReturnType<typeof setTimeout> | null = null;

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(() => {
      this.visibleCount = this.computeVisibleCount();
      this.pageStart = Math.min(this.pageStart, this.maxPageStart);
      this.applyCarouselPosition();
    }, 120);
  }

  // ---------- Viewer dọc kiểu reels/TikTok (mở khi bấm 1 thẻ) ----------
  viewerOpen = false;
  viewerIndex = 0;
  private viewerDragStartY = 0;
  private viewerDragging = false;

  constructor(private sanitizer: DomSanitizer, private toast: ToastService) {}

  ngAfterViewInit(): void {
    // Player YouTube được tạo lazy khi div đích (#ytTarget) của 1 thẻ xuất hiện lần đầu trong DOM
    // (khi thẻ được hover lần đầu — xem onCardHoverStart).
    this.ytTargets.changes.subscribe((list: QueryList<ElementRef<HTMLDivElement>>) => {
      list.forEach(ref => {
        const index = Number(ref.nativeElement.dataset['index']);
        if (!this.players.has(index)) this.createPlayer(index, ref.nativeElement);
      });
    });

    this.visibleCount = this.computeVisibleCount();
    this.applyCarouselPosition();
  }

  ngOnDestroy(): void {
    if (this.resizeTimer) clearTimeout(this.resizeTimer);
    this.players.forEach(player => player.destroy?.());
    this.restoreBodyScroll();
  }

  // ---------- YouTube player (preview tự phát muted khi hover) ----------

  private async createPlayer(index: number, target: HTMLElement): Promise<void> {
    const topic = this.topics[index];
    if (!topic.youtubeId) return;
    await loadYoutubeIframeApi();

    const player = new window.YT.Player(target, {
      videoId: topic.youtubeId,
      host: 'https://www.youtube-nocookie.com',
      width: '100%',
      height: '100%',
      playerVars: {
        autoplay: 0,
        mute: 1,
        controls: 0,
        modestbranding: 1,
        rel: 0,
        playsinline: 1,
        loop: 1,
        playlist: topic.youtubeId,
        fs: 0,
        iv_load_policy: 3,
        disablekb: 1,
      },
      events: {
        onReady: () => {
          this.players.set(index, player);
          if (this.hoveredIndex === index) player.playVideo();
        },
        // Video không tồn tại/riêng tư/chủ sở hữu tắt nhúng (mã lỗi 2/5/100/101/150) — YouTube
        // vẫn coi player là "ready" nhưng không có gì để phát. Dọn player hỏng và quay lại hiện
        // ảnh poster tĩnh như thẻ không có video, thay vì để khung đen/nhúng lỗi trống trơn.
        onError: () => {
          this.erroredIndices.add(index);
          this.loadedIndices.delete(index);
          this.players.delete(index);
          player.destroy?.();
        },
      },
    });
  }

  /** Bấm vào thẻ (ảnh/preview) -> mở viewer dọc xem full. */
  onCardMediaClick(index: number, event: Event): void {
    this.openViewer(index, event);
  }

  isLoaded(index: number): boolean {
    return this.loadedIndices.has(index);
  }

  hasError(index: number): boolean {
    return this.erroredIndices.has(index);
  }

  /** true khi thẻ đang thật sự phát video (đang được hover) — dùng để ẩn ảnh tĩnh và hiện player. */
  isPlaying(index: number): boolean {
    return this.isLoaded(index) && !this.hasError(index) && this.hoveredIndex === index;
  }

  /** Ảnh tĩnh hiển thị khi chưa phát: dùng khung hình thumbnail thật của chính video đó
   *  (YouTube luôn có sẵn, không cần API) thay vì ảnh poster rời rạc không liên quan tới video. */
  posterUrl(topic: VideoTopic): string {
    return topic.youtubeId
      ? `https://img.youtube.com/vi/${topic.youtubeId}/hqdefault.jpg`
      : topic.poster;
  }

  /** Trỏ chuột vào thẻ (desktop) -> phát video; rời chuột -> dừng. Bảo đảm player đã được tạo
   *  (lazy) trước khi gọi playVideo. */
  onCardHoverStart(index: number): void {
    const topic = this.topics[index];
    if (!topic.youtubeId || this.hasError(index)) return;
    this.hoveredIndex = index;
    this.loadedIndices.add(index);
    this.players.get(index)?.playVideo();
  }

  onCardHoverEnd(index: number): void {
    if (this.hoveredIndex !== index) return;
    this.hoveredIndex = null;
    this.players.get(index)?.pauseVideo();
  }

  // ---------- Viewer dọc kiểu reels/TikTok ----------

  get viewerTopic(): VideoTopic | undefined {
    return this.topics[this.viewerIndex];
  }

  /** Cache theo index — SafeResourceUrl là object mới mỗi lần gọi sanitizer, nếu không cache thì
   *  binding [src] tưởng URL đổi ở mỗi vòng change detection và làm iframe reload/giật liên tục. */
  private embedUrlCache = new Map<number, SafeResourceUrl>();

  get viewerEmbedUrl(): SafeResourceUrl | null {
    const id = this.viewerTopic?.youtubeId;
    if (!id || this.erroredIndices.has(this.viewerIndex)) return null;
    const cached = this.embedUrlCache.get(this.viewerIndex);
    if (cached) return cached;
    const url = `https://www.youtube-nocookie.com/embed/${id}` +
      `?autoplay=1&mute=1&controls=1&modestbranding=1&rel=0&playsinline=1&loop=1&playlist=${id}`;
    const safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    this.embedUrlCache.set(this.viewerIndex, safeUrl);
    return safeUrl;
  }

  /** true = mô tả đang thu gọn (ẩn bớt) — mặc định mở rộng, giống trạng thái "Thu gọn" trong ảnh mẫu. */
  infoCollapsed = false;

  openViewer(index: number, event: Event): void {
    event.stopPropagation();
    this.viewerIndex = index;
    this.viewerAnimDirection = null;
    this.infoCollapsed = false;
    this.viewerOpen = true;
    document.body.style.overflow = 'hidden';
  }

  closeViewer(): void {
    this.viewerOpen = false;
    this.restoreBodyScroll();
  }

  private restoreBodyScroll(): void {
    document.body.style.overflow = '';
  }

  /** Hướng slide hiện tại ('next' trượt lên, 'prev' trượt xuống) — dùng để bật animation
   *  CSS khi đổi video, giống hiệu ứng chuyển cảnh dọc của Reels/TikTok. */
  viewerAnimDirection: 'next' | 'prev' | null = null;

  /** Chuyển video kế/trước trong viewer — bấm nút mũi tên, vuốt dọc, hoặc lăn chuột đều gọi hàm này.
   *  Khóa trong lúc animation trượt còn đang chạy (viewerAnimDirection != null) để vuốt/lăn chuột
   *  liên tục không bị "nuốt" nhiều bước cùng lúc — mỗi lượt kéo/lăn chỉ chuyển đúng 1 video. */
  viewerStep(direction: 1 | -1): void {
    if (this.viewerAnimDirection !== null) return;
    const next = this.viewerIndex + direction;
    if (next < 0 || next >= this.topics.length) return;
    this.viewerIndex = next;
    this.viewerAnimDirection = direction === 1 ? 'next' : 'prev';
    this.infoCollapsed = false;
  }

  onViewerAnimEnd(): void {
    this.viewerAnimDirection = null;
  }

  get canViewerPrev(): boolean {
    return this.viewerIndex > 0;
  }

  get canViewerNext(): boolean {
    return this.viewerIndex < this.topics.length - 1;
  }

  @HostListener('window:keydown', ['$event'])
  onViewerKeydown(event: KeyboardEvent): void {
    if (!this.viewerOpen) return;
    if (event.key === 'Escape') this.closeViewer();
    else if (event.key === 'ArrowUp') this.viewerStep(-1);
    else if (event.key === 'ArrowDown') this.viewerStep(1);
  }

  onViewerPointerDown(event: PointerEvent): void {
    this.viewerDragging = true;
    this.viewerDragStartY = event.clientY;
  }

  onViewerPointerUp(event: PointerEvent): void {
    if (!this.viewerDragging) return;
    this.viewerDragging = false;
    const dy = event.clientY - this.viewerDragStartY;
    if (dy <= -SWIPE_THRESHOLD) this.viewerStep(1);
    else if (dy >= SWIPE_THRESHOLD) this.viewerStep(-1);
  }

  /** Lăn chuột trong viewer (desktop) — mỗi lần lăn chỉ đổi đúng 1 video (viewerStep tự khóa
   *  trong lúc animation trượt đang chạy, xem ghi chú ở đó). */
  onViewerWheel(event: WheelEvent): void {
    event.preventDefault();
    if (Math.abs(event.deltaY) < WHEEL_MIN_DELTA) return;
    this.viewerStep(event.deltaY > 0 ? 1 : -1);
  }

  shareViewer(event: Event): void {
    event.stopPropagation();
    const topic = this.viewerTopic;
    if (!topic?.youtubeId) return;
    const url = `https://youtu.be/${topic.youtubeId}`;

    if (navigator.share) {
      navigator.share({ title: topic.title, text: topic.description, url }).catch(() => {});
      return;
    }
    navigator.clipboard?.writeText(url).then(
      () => this.toast.success('Đã sao chép liên kết video'),
      () => {}
    );
  }

}
