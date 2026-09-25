import { Component, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CommunityService } from '../../core/services/community.service';
import { ProductService } from '../../core/services/product.service';
import { CartService } from '../../core/services/cart.service';
import { AuthService } from '../../core/services/auth.service';
import { LoginModalService } from '../../core/services/login-modal.service';
import { ToastService } from '../../core/services/toast.service';
import { CommunityPost, ProductTag } from '../../core/models/community.model';
import { Product } from '../../core/models/product.model';
import { AppIconComponent } from '../../components/icon/icon.component';
import { VndPipe } from '../../shared/pipes/vnd.pipe';

type SortKey = 'popular' | 'newest';
/** Nguồn feed ở sidebar trái (kiểu Threads): tất cả / bài đã lưu / bài đã thích. */
type FeedMode = 'all' | 'saved' | 'liked';

interface TopicFilter {
  key: string;
  label: string;
  /** Từ khoá (không dấu, thường) để nhận diện chủ đề từ title/caption/hashtag — dữ liệu
   *  Community hiện không có field topic riêng nên suy ra từ nội dung có sẵn. */
  keywords: string[];
}

const TOPIC_FILTERS: TopicFilter[] = [
  { key: 'all', label: 'Tất cả', keywords: [] },
  { key: 'phong-khach', label: 'Phòng khách', keywords: ['phong khach', 'living room', 'sofa'] },
  { key: 'phong-ngu', label: 'Phòng ngủ', keywords: ['phong ngu', 'bedroom', 'giuong ngu'] },
  { key: 'goc-lam-viec', label: 'Góc làm việc', keywords: ['goc lam viec', 'ban hoc', 'desksetup', 'desk setup', 'workspace', 'ban lam viec'] },
  { key: 'decor-3d', label: 'Decor 3D', keywords: ['deco3d', 'in 3d', '3d print', 'moonlamp', 'tuy bien'] },
  { key: 'khong-gian-nho', label: 'Không gian nhỏ', keywords: ['khong gian nho', 'small space', 'goc nho', 'mini'] },
  { key: 'toi-gian', label: 'Tối giản', keywords: ['toi gian', 'minimalist', 'minimal'] },
  { key: 'japandi', label: 'Japandi', keywords: ['japandi'] },
];

const TRENDING_COUNT = 5;
const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80';

const INITIAL_VISIBLE = 8;
const LOAD_MORE_STEP = 8;

@Component({
  selector: 'app-community',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AppIconComponent, VndPipe],
  templateUrl: './community.component.html',
  styleUrl: './community.component.css'
})
export class CommunityComponent implements OnInit {
  readonly topicFilters = TOPIC_FILTERS;
  readonly feedTabs: { key: SortKey; label: string }[] = [
    { key: 'popular', label: 'Dành cho bạn' },
    { key: 'newest', label: 'Mới nhất' },
  ];
  readonly feedModes: { key: FeedMode; label: string; icon: string }[] = [
    { key: 'all', label: 'Trang chủ', icon: 'home' },
    { key: 'saved', label: 'Đã lưu', icon: 'bookmark' },
    { key: 'liked', label: 'Đã thích', icon: 'heart' },
  ];

  posts: CommunityPost[] = [];
  filteredPosts: CommunityPost[] = [];
  availableProducts: Product[] = [];

  feedMode: FeedMode = 'all';
  activeFilter = 'all';
  searchQuery = '';
  sortBy: SortKey = 'popular';
  visibleCount = INITIAL_VISIBLE;

  showCreateModal = false;
  newPostTitle = '';
  newPostCaption = '';
  newPostImageUrl = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80';
  selectedTagProductId = '';

  /** id bài đang mở Post Detail — không lưu cả object để tránh lệch dữ liệu khi like/comment cập nhật posts. */
  activePostId: string | null = null;
  commentInputs: { [key: string]: string } = {};
  /** id bài vừa bấm tim — bật animation pulse ngắn rồi tự tắt. */
  pulsingLikeId: string | null = null;

  constructor(
    private communityService: CommunityService,
    private productService: ProductService,
    private cartService: CartService,
    public authService: AuthService,
    public loginModalService: LoginModalService,
    private toastService: ToastService
  ) {
    // posts/products nạp bất đồng bộ từ backend — effect() tự đồng bộ lại mỗi khi signal đổi.
    effect(() => {
      this.posts = this.communityService.posts();
      this.applyFilters();
    });
    effect(() => {
      this.availableProducts = this.productService.products();
    });
  }

  ngOnInit(): void {}

  get activePost(): CommunityPost | undefined {
    return this.activePostId ? this.posts.find(p => p.id === this.activePostId) : undefined;
  }

  get visiblePosts(): CommunityPost[] {
    return this.filteredPosts.slice(0, this.visibleCount);
  }

  get hasMorePosts(): boolean {
    return this.visibleCount < this.filteredPosts.length;
  }

  get currentFeedLabel(): string {
    if (this.feedMode === 'saved') return 'Đã lưu';
    if (this.feedMode === 'liked') return 'Đã thích';
    return this.feedTabs.find(t => t.key === this.sortBy)?.label ?? 'Cộng đồng Decor';
  }

  get emptyTitle(): string {
    if (this.feedMode === 'saved' && !this.searchQuery && this.activeFilter === 'all') return 'Bạn chưa lưu bài viết nào';
    if (this.feedMode === 'liked' && !this.searchQuery && this.activeFilter === 'all') return 'Bạn chưa thích bài viết nào';
    return 'Không tìm thấy bài viết phù hợp';
  }

  /** Bài nhiều lượt thích nhất cho khối Trending ở sidebar phải. */
  get trendingPosts(): CommunityPost[] {
    return [...this.posts].sort((a, b) => b.likesCount - a.likesCount).slice(0, TRENDING_COUNT);
  }

  get currentAvatar(): string {
    const user = this.authService.currentUser();
    return (user && this.authService.getAvatarUrl(user.avatar)) || DEFAULT_AVATAR;
  }

  get currentUserName(): string {
    const user = this.authService.currentUser();
    return user ? (user.fullName || user.phoneNumber) : 'Bạn';
  }

  getProduct(id: string): Product | undefined {
    return this.productService.getProductById(id);
  }

  // ---------- Filter / Search / Sort ----------

  private normalize(s: string): string {
    return s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/đ/gi, 'd');
  }

  private matchesTopic(post: CommunityPost, filter: TopicFilter): boolean {
    if (!filter.keywords.length) return true;
    const haystack = this.normalize(`${post.title} ${post.caption} ${post.tags.join(' ')}`);
    return filter.keywords.some(k => haystack.includes(k));
  }

  private matchesSearch(post: CommunityPost, query: string): boolean {
    const haystack = this.normalize(
      `${post.title} ${post.caption} ${post.tags.join(' ')} ${post.author.name} ${post.author.handle}`
    );
    return haystack.includes(query);
  }

  private sortPosts(list: CommunityPost[]): CommunityPost[] {
    const arr = [...list];
    switch (this.sortBy) {
      case 'newest':
        // Bài mới được service prepend vào đầu danh sách khi tạo — giữ nguyên thứ tự trả về
        // vì createdAt là chuỗi hiển thị tương đối ("Hôm qua lúc 20:30"), không so sánh được.
        return arr;
      case 'popular':
      default:
        return arr.sort((a, b) => (b.likesCount + b.commentsCount) - (a.likesCount + a.commentsCount));
    }
  }

  applyFilters(): void {
    const filter = this.topicFilters.find(f => f.key === this.activeFilter) ?? this.topicFilters[0];
    const query = this.normalize(this.searchQuery.trim());

    let list = this.posts.filter(p => this.matchesTopic(p, filter));
    if (this.feedMode === 'saved') list = list.filter(p => p.isSaved);
    else if (this.feedMode === 'liked') list = list.filter(p => p.isLiked);
    if (query) {
      list = list.filter(p => this.matchesSearch(p, query));
    }
    this.filteredPosts = this.sortPosts(list);
    this.visibleCount = INITIAL_VISIBLE;
  }

  setFilter(key: string): void {
    this.activeFilter = key;
    this.activePostId = null;
    this.applyFilters();
  }

  setFeedMode(mode: FeedMode): void {
    this.feedMode = mode;
    this.activePostId = null;
    this.applyFilters();
  }

  onSearchChange(): void {
    this.activePostId = null;
    this.applyFilters();
  }

  setSort(key: SortKey): void {
    this.sortBy = key;
    this.applyFilters();
  }

  loadMore(): void {
    this.visibleCount = Math.min(this.visibleCount + LOAD_MORE_STEP, this.filteredPosts.length);
  }

  // ---------- Post interactions ----------

  toggleLike(postId: string, event?: Event): void {
    event?.stopPropagation();
    this.communityService.toggleLike(postId);
    this.pulsingLikeId = postId;
    setTimeout(() => {
      if (this.pulsingLikeId === postId) this.pulsingLikeId = null;
    }, 320);
  }

  toggleSave(postId: string, event?: Event): void {
    event?.stopPropagation();
    this.communityService.toggleSave(postId);
  }

  addComment(postId: string): void {
    const text = this.commentInputs[postId]?.trim();
    if (!text) return;
    this.communityService.addComment(postId, text, 'Bạn');
    this.commentInputs[postId] = '';
  }

  openTagPopover(tag: ProductTag): void {}

  // ---------- Post Detail ----------

  /** Mở thread chi tiết ngay trong cột giữa (kiểu Threads), cuộn về đầu trang. */
  openPost(post: CommunityPost, event?: Event): void {
    event?.stopPropagation();
    this.activePostId = post.id;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  closePost(): void {
    this.activePostId = null;
  }

  // ---------- Create post modal ----------

  /** Đăng bài yêu cầu đăng nhập — cần userId thật để tính Xu thưởng và gắn đúng tác giả. */
  openCreateModal(): void {
    if (!this.authService.currentUser()) {
      this.loginModalService.open();
      return;
    }
    this.showCreateModal = true;
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
  }

  publishPost(): void {
    const user = this.authService.currentUser();
    if (!user || !this.newPostTitle || !this.newPostImageUrl) return;

    const tags: ProductTag[] = [];
    if (this.selectedTagProductId) {
      tags.push({
        productId: this.selectedTagProductId,
        xPercent: 50,
        yPercent: 50,
      });
    }

    this.communityService.createPost({
      userId: user._id,
      author: {
        id: user._id,
        name: user.fullName || user.phoneNumber,
        avatar: this.authService.getAvatarUrl(user.avatar) || DEFAULT_AVATAR,
        handle: '@' + user.phoneNumber,
      },
      title: this.newPostTitle,
      caption: this.newPostCaption,
      imageUrl: this.newPostImageUrl,
      tags: ['#decor', '#goccanhan', '#deco3d'],
      productTags: tags,
    }).subscribe({
      next: () => {
        this.toastService.success('Đã đăng bài lên Cộng đồng Decor!');
        this.showCreateModal = false;
        this.newPostTitle = '';
        this.newPostCaption = '';
        this.selectedTagProductId = '';
      },
      // Bị bộ lọc chặn (vi phạm tiêu chuẩn cộng đồng) hoặc lỗi mạng: giữ nguyên modal để sửa lại.
      error: (err) => this.toastService.error(err?.error?.error || 'Không đăng được bài, vui lòng thử lại.', 6000),
    });
  }
}
