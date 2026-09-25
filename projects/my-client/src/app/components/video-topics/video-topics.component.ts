import { AfterViewInit, Component, ElementRef, computed, HostListener, NgZone, OnDestroy, OnInit, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AppIconComponent } from '../icon/icon.component';
import { ToastService } from '../../core/services/toast.service';
import { MascotService, MascotExpression } from '../../core/services/mascot.service';
import { VideoService, VideoItem } from '../../core/services/video.service';

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

/** Danh sách dự phòng — dùng khi chưa tải được video do nhân viên đăng ở my-admin (API /videos). */
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
export class VideoTopicsComponent implements OnInit, AfterViewInit, OnDestroy {
  topics: VideoTopic[] = TOPICS;
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

  constructor(
    private zone: NgZone,
    private toast: ToastService,
    private mascotService: MascotService,
    private videoService: VideoService
  ) {}

  ngOnInit(): void {
    this.videoService.getVideos().subscribe({
      next: (videos) => {
        if (videos.length > 0) this.applyVideos(videos);
      },
      error: (err) => console.warn('Failed to load videos, using default topics', err),
    });
  }

  /** Thay danh sách thẻ bằng video từ server. Player YouTube gắn theo index nên phải huỷ hết
   *  player cũ (nếu người dùng đã hover trước khi dữ liệu về) để không phát nhầm video. */
  private applyVideos(videos: VideoItem[]): void {
    if (this.viewerOpen) return;
    this.players.forEach(player => player.destroy?.());
    this.players.clear();
    this.loadedIndices.clear();
    this.erroredIndices.clear();
    this.hoveredIndex = null;
    this.topics = videos.map(v => ({
      title: v.title,
      description: v.description,
      link: v.link || undefined,
      ctaLabel: v.ctaLabel || 'Xem thêm',
      poster: v.poster || `https://img.youtube.com/vi/${v.youtubeId}/hqdefault.jpg`,
      youtubeId: v.youtubeId,
    }));
    this.pageStart = 0;
    // Chờ Angular vẽ lại danh sách thẻ rồi mới đo kích thước để đặt lại carousel.
    setTimeout(() => this.applyCarouselPosition());
  }

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
    this.destroyViewerPlayer();
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
          this.mascotService.react('sad');
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

  /** Ảnh mascot Goh ở thẻ trái của viewer — đổi theo biểu cảm hiện tại của MascotService. */
  readonly mascotImg = computed(() => {
    const expression: MascotExpression = this.mascotService.expression();
    return expression === 'idle' ? 'assets/mascot/goh-mascot.png' : `assets/mascot/goh-${expression}.png`;
  });

  /** Tối đa 2 video kế tiếp (không xoay vòng) cho mục "Tiếp theo" trong bảng mô tả. */
  get upNextTopics(): { topic: VideoTopic; index: number }[] {
    return this.topics
      .slice(this.viewerIndex + 1, this.viewerIndex + 3)
      .map((topic, k) => ({ topic, index: this.viewerIndex + 1 + k }));
  }

  pad2(value: number): string {
    return String(value).padStart(2, '0');
  }

  openViewer(index: number, event: Event): void {
    event.stopPropagation();
    // Dừng preview đang hover ở carousel để không phát chồng hình phía sau viewer.
    this.players.forEach(player => player.pauseVideo?.());
    this.hoveredIndex = null;
    this.viewerIndex = index;
    this.viewerAnimDirection = null;
    this.viewerMuted = true;
    this.viewerOpen = true;
    document.body.style.overflow = 'hidden';
    // Ẩn banner nổi 2 bên của trang (floating-side-banners) — viewer đã có thẻ mascot/bảng mô tả riêng.
    document.body.classList.add('vw-open');
  }

  closeViewer(): void {
    this.viewerOpen = false;
    this.destroyViewerPlayer();
    this.restoreBodyScroll();
  }

  private restoreBodyScroll(): void {
    document.body.style.overflow = '';
    document.body.classList.remove('vw-open');
  }

  // ---------- Player của viewer (YouTube IFrame API để điều khiển được âm thanh) ----------

  /** Trình duyệt chỉ cho autoplay khi tắt tiếng, nên viewer luôn mở ở trạng thái muted; người dùng
   *  bấm nút loa (hoặc nút loa trong control của YouTube) để bật tiếng — đó là thao tác hợp lệ. */
  viewerMuted = true;
  /** Người dùng đã chủ động bật tiếng — giữ lựa chọn này khi chuyển sang video khác trong viewer. */
  private viewerWantsSound = false;
  private viewerPlayer: any = null;
  private viewerSyncTimer: ReturnType<typeof setInterval> | null = null;
  private viewerSoundCheckTimer: ReturnType<typeof setTimeout> | null = null;

  /** Div đích xuất hiện khi viewer mở (*ngIf) -> tạo player 1 lần, các lần đổi video dùng loadVideoById. */
  @ViewChild('viewerYt')
  set viewerYtTarget(ref: ElementRef<HTMLDivElement> | undefined) {
    if (ref && !this.viewerPlayer) this.createViewerPlayer(ref.nativeElement);
  }

  private async createViewerPlayer(target: HTMLElement): Promise<void> {
    const videoId = this.viewerTopic?.youtubeId;
    if (!videoId) return;
    await loadYoutubeIframeApi();
    if (!this.viewerOpen || this.viewerPlayer) return;

    this.viewerPlayer = new window.YT.Player(target, {
      videoId,
      host: 'https://www.youtube-nocookie.com',
      width: '100%',
      height: '100%',
      playerVars: {
        autoplay: 1,
        mute: 1,
        controls: 1,
        fs: 1,
        modestbranding: 1,
        rel: 0,
        playsinline: 1,
        iv_load_policy: 3,
      },
      events: {
        onReady: (e: any) => {
          e.target.mute();
          e.target.playVideo();
          this.startViewerSync();
        },
        // loop=1 của YouTube không áp dụng cho video nạp bằng loadVideoById -> tự phát lại khi hết.
        onStateChange: (e: any) => {
          if (e.data === window.YT.PlayerState.ENDED) {
            e.target.seekTo(0);
            e.target.playVideo();
          }
        },
        onError: () => {
          this.erroredIndices.add(this.viewerIndex);
          this.mascotService.react('sad');
        },
      },
    });
  }

  /** Đồng bộ icon loa khi người dùng bật/tắt tiếng bằng control gốc của YouTube. Chạy ngoài Angular
   *  zone, chỉ quay lại zone khi trạng thái thực sự đổi. */
  private startViewerSync(): void {
    this.stopViewerSync();
    this.zone.runOutsideAngular(() => {
      this.viewerSyncTimer = setInterval(() => {
        const muted = this.viewerPlayer?.isMuted?.();
        if (typeof muted === 'boolean' && muted !== this.viewerMuted) {
          this.zone.run(() => {
            this.viewerMuted = muted;
            this.viewerWantsSound = !muted;
          });
        }
      }, 400);
    });
  }

  private stopViewerSync(): void {
    if (this.viewerSyncTimer) clearInterval(this.viewerSyncTimer);
    this.viewerSyncTimer = null;
  }

  private destroyViewerPlayer(): void {
    this.stopViewerSync();
    if (this.viewerSoundCheckTimer) clearTimeout(this.viewerSoundCheckTimer);
    this.viewerPlayer?.destroy?.();
    this.viewerPlayer = null;
  }

  toggleViewerSound(event?: Event): void {
    event?.stopPropagation();
    const player = this.viewerPlayer;
    if (!player?.isMuted) return;
    if (player.isMuted()) {
      player.unMute();
      if (player.getVolume?.() === 0) player.setVolume(80);
      player.playVideo();
      this.viewerMuted = false;
      this.viewerWantsSound = true;
    } else {
      player.mute();
      this.viewerMuted = true;
      this.viewerWantsSound = false;
    }
  }

  /** Nạp video của viewerIndex hiện tại vào player có sẵn. Nếu người dùng đã bật tiếng thì thử phát
   *  có tiếng; trình duyệt chặn (video không chạy) thì quay về autoplay muted — không ép. */
  private loadViewerVideo(): void {
    const player = this.viewerPlayer;
    const videoId = this.viewerTopic?.youtubeId;
    if (!player?.loadVideoById) return;
    if (!videoId || this.hasError(this.viewerIndex)) {
      player.pauseVideo?.();
      return;
    }
    if (this.viewerWantsSound) player.unMute();
    else player.mute();
    player.loadVideoById(videoId);

    if (this.viewerSoundCheckTimer) clearTimeout(this.viewerSoundCheckTimer);
    if (!this.viewerWantsSound) return;
    this.viewerSoundCheckTimer = setTimeout(() => {
      const state = this.viewerPlayer?.getPlayerState?.();
      const PS = window.YT.PlayerState;
      if (state !== PS.PLAYING && state !== PS.BUFFERING) {
        this.viewerPlayer?.mute();
        this.viewerPlayer?.playVideo();
        this.viewerMuted = true;
        this.viewerWantsSound = false;
      }
    }, 1500);
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
    this.loadViewerVideo();
  }

  /** Nhảy thẳng tới 1 video (thanh đếm hoặc danh sách "Tiếp theo" trong bảng mô tả). */
  viewerGoTo(index: number): void {
    if (index === this.viewerIndex || this.viewerAnimDirection !== null) return;
    this.viewerAnimDirection = index > this.viewerIndex ? 'next' : 'prev';
    this.viewerIndex = index;
    this.loadViewerVideo();
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
    else if (event.key === 'm' || event.key === 'M') this.toggleViewerSound();
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
