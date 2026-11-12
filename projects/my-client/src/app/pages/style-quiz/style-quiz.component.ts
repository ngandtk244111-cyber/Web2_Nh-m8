import { Component, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { QuizService } from '../../core/services/quiz.service';
import { VoucherService } from '../../core/services/voucher.service';
import { AuthService } from '../../core/services/auth.service';
import { LoginModalService } from '../../core/services/login-modal.service';
import { ProductService } from '../../core/services/product.service';
import { ToastService } from '../../core/services/toast.service';
import { CartService } from '../../core/services/cart.service';
import { ChatPanelService } from '../../core/services/chat-panel.service';
import { DecorStyleTag, QuizOption, StyleResult } from '../../core/models/quiz.model';
import { Product } from '../../core/models/product.model';
import { AppIconComponent } from '../../components/icon/icon.component';
import { VndPipe } from '../../shared/pipes/vnd.pipe';
import { CatalogLink, legacyCategoryLink } from '../../core/data/catalog-taxonomy';
import { ProductPhotoComponent } from '../../components/product-photo/product-photo.component';

/** Giữ kết quả trắc nghiệm trong phiên — bấm xem sản phẩm rồi quay lại vẫn thấy kết quả, không phải làm lại. */
const RESULT_STORAGE_KEY = 'lumea_style_quiz_result';
const PREVIEW_LIMIT = 8;

export const STYLE_LABELS: Record<DecorStyleTag, string> = {
  minimalist: 'Tối giản',
  scandinavian: 'Bắc Âu',
  industrial: 'Công nghiệp',
  bohemian: 'Bohemian',
};

interface SavedQuizState {
  answers: Record<number, DecorStyleTag>;
  attemptId: string | null;
  coinClaimed: boolean;
}

interface SuggestedCategory {
  category: string;
  link: CatalogLink;
}

/** 'locked': đã làm xong nhưng chưa đăng nhập — phải đăng nhập mới xem được kết quả. */
type Screen = 'intro' | 'quiz' | 'locked' | 'result';

@Component({
  selector: 'app-style-quiz',
  standalone: true,
  imports: [ProductPhotoComponent, CommonModule, RouterLink, AppIconComponent, VndPipe],
  templateUrl: './style-quiz.component.html',
  styleUrl: './style-quiz.component.css'
})
export class StyleQuizComponent {
  screen: Screen = 'intro';
  currentIndex = 0;
  answers: Record<number, DecorStyleTag> = {};
  result: StyleResult | null = null;

  attemptId: string | null = null;
  coinClaimed = false;
  coinBusy = false;
  showCelebration = false;
  showFlyingCoin = false;
  readonly rewardLabel = 'voucher giảm 10%';

  /** Danh mục gợi ý của kết quả (kèm tên thật) + danh mục đang xem trước ngay trong trang. */
  suggestedCategories: SuggestedCategory[] = [];
  activeCategory: SuggestedCategory | null = null;

  /** Tỉ lệ % 4 phong cách theo đáp án, cao nhất trước. */
  scores: { tag: DecorStyleTag; label: string; percent: number }[] = [];
  readonly styleLabels = STYLE_LABELS;

  constructor(
    private quizService: QuizService,
    public voucherService: VoucherService,
    public authService: AuthService,
    public loginModalService: LoginModalService,
    private productService: ProductService,
    private toastService: ToastService,
    private cartService: CartService,
    private chatPanel: ChatPanelService
  ) {
    this.restoreResult();
    // Làm xong khi chưa đăng nhập → đăng nhập (ngay trên trang này) xong thì hiện kết quả luôn.
    effect(() => {
      if (this.authService.currentUser() && this.screen === 'locked') this.showResult();
    });
  }

  /** Sản phẩm của 1 loại, món đúng phong cách (Product.style) lên trước, rồi theo đánh giá. */
  private rankedProducts(category: string): Product[] {
    const styles = this.result?.productStyles || [];
    const score = (p: Product) =>
      (styles.includes(p.style as string) ? 1000 : 0) + (p.rating || 0) * 10 + Math.min(p.reviewCount || 0, 50) / 10;
    return this.productService.products()
      .filter(p => p.category === category && p.images?.length)
      .sort((a, b) => score(b) - score(a));
  }

  /** Vài sản phẩm hợp phong cách của danh mục đang chọn để xem nhanh ngay dưới kết quả. */
  get previewProducts(): Product[] {
    const cat = this.activeCategory?.category;
    return cat ? this.rankedProducts(cat).slice(0, PREVIEW_LIMIT) : [];
  }

  /** Tên danh mục con thật (vd "Bình Hoa & Lọ Decor") — tên nhóm lớn của link có thể trùng giữa các tab. */
  categoryName(cat: SuggestedCategory): string {
    return this.productService.products().find(p => p.category === cat.category)?.categoryName || cat.link.label;
  }

  /** Món có đúng phong cách hay chỉ là món bán chạy cùng loại — để gắn nhãn "Đúng gu". */
  matchesStyle(p: Product): boolean {
    return !!this.result?.productStyles?.includes(p.style as string);
  }

  /** Bộ phối sẵn: mỗi loại trong comboCategories lấy 1 món hợp phong cách nhất, còn hàng. */
  get comboProducts(): Product[] {
    return (this.result?.comboCategories || [])
      .map(cat => this.rankedProducts(cat).find(p => p.productionType !== 'READY_STOCK' || p.inStock > 0))
      .filter((p): p is Product => !!p);
  }

  get comboTotal(): number {
    return this.comboProducts.reduce((sum, p) => sum + p.basePrice, 0);
  }

  addComboToCart(): void {
    const items = this.comboProducts;
    const added = items.filter(p => this.cartService.addToCart(p)).length;
    if (added) this.toastService.success(`Đã thêm ${added} món của bộ phối sẵn vào giỏ hàng`);
  }

  /** Phong cách phụ (điểm cao thứ 2) — chỉ nhắc khi đủ đáng kể. */
  get secondaryStyle(): { label: string; percent: number } | null {
    const second = this.scores[1];
    return second && second.percent >= 20 ? second : null;
  }

  askAi(): void {
    this.chatPanel.open('ai');
  }

  selectCategory(cat: SuggestedCategory): void {
    this.activeCategory = cat;
  }

  get questions() {
    return this.quizService.questions;
  }

  get currentQuestion() {
    return this.questions[this.currentIndex];
  }

  get progress(): number {
    return ((this.currentIndex) / this.questions.length) * 100;
  }

  /** Ai cũng làm được trắc nghiệm; chỉ bước xem kết quả mới cần đăng nhập. */
  startQuiz(): void {
    this.screen = 'quiz';
    this.currentIndex = 0;
    this.answers = {};
    this.result = null;
    this.resetCoinState();
  }

  selectOption(option: QuizOption): void {
    this.answers[this.currentQuestion.id] = option.tag;
    if (this.currentIndex < this.questions.length - 1) {
      this.currentIndex++;
    } else {
      this.finishQuiz();
    }
  }

  goBack(): void {
    if (this.currentIndex > 0) this.currentIndex--;
  }

  private finishQuiz(): void {
    this.attemptId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    this.saveResult();
    if (this.authService.currentUser()) {
      this.showResult();
    } else {
      this.screen = 'locked';
    }
  }

  loginToSeeResult(): void {
    this.loginModalService.open();
  }

  private showResult(): void {
    this.result = this.quizService.computeResult(this.answers);
    this.scores = this.quizService.computeScores(this.answers).map(s => ({ ...s, label: STYLE_LABELS[s.tag] }));
    this.screen = 'result';
    this.suggestedCategories = this.result.suggestedCategories.map(category => ({
      category,
      link: legacyCategoryLink(category),
    }));
    this.activeCategory = this.suggestedCategories[0] ?? null;
  }

  private saveResult(): void {
    const state: SavedQuizState = { answers: this.answers, attemptId: this.attemptId, coinClaimed: this.coinClaimed };
    try {
      sessionStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(state));
    } catch { /* trình duyệt chặn storage → chỉ mất tính năng nhớ kết quả */ }
  }

  private restoreResult(): void {
    try {
      const raw = sessionStorage.getItem(RESULT_STORAGE_KEY);
      if (!raw) return;
      const state = JSON.parse(raw) as SavedQuizState;
      if (!state?.answers || !Object.keys(state.answers).length) return;
      this.answers = state.answers;
      this.attemptId = state.attemptId;
      this.coinClaimed = !!state.coinClaimed;
      if (this.authService.currentUser()) this.showResult();
      else this.screen = 'locked';
    } catch {
      sessionStorage.removeItem(RESULT_STORAGE_KEY);
    }
  }

  private clearSavedResult(): void {
    try {
      sessionStorage.removeItem(RESULT_STORAGE_KEY);
    } catch { /* bỏ qua */ }
  }

  private resetCoinState(): void {
    this.attemptId = null;
    this.coinClaimed = false;
    this.coinBusy = false;
    this.showCelebration = false;
    this.showFlyingCoin = false;
  }

  openClaimCelebration(): void {
    if (!this.attemptId || this.coinClaimed) return;
    if (!this.authService.currentUser()) {
      this.loginModalService.open();
      return;
    }
    this.showCelebration = true;
  }

  closeCelebration(): void {
    this.showCelebration = false;
  }

  async confirmClaim(): Promise<void> {
    if (!this.attemptId || this.coinBusy || this.coinClaimed) return;
    this.showCelebration = false;
    this.coinBusy = true;
    try {
      await this.voucherService.claim('STYLE_QUIZ', this.attemptId);
      this.coinClaimed = true;
      this.saveResult();
      this.showFlyingCoin = true;
      setTimeout(() => { this.showFlyingCoin = false; }, 1800);
    } catch {
      // giữ nguyên trạng thái, người dùng có thể bấm nhận lại
    } finally {
      this.coinBusy = false;
    }
  }

  retakeQuiz(): void {
    this.screen = 'intro';
    this.currentIndex = 0;
    this.answers = {};
    this.result = null;
    this.suggestedCategories = [];
    this.activeCategory = null;
    this.scores = [];
    this.clearSavedResult();
    this.resetCoinState();
  }
}
