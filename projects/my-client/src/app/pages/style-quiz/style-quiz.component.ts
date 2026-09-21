import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { QuizService } from '../../core/services/quiz.service';
import { CoinService } from '../../core/services/coin.service';
import { AuthService } from '../../core/services/auth.service';
import { LoginModalService } from '../../core/services/login-modal.service';
import { DecorStyleTag, QuizOption, StyleResult } from '../../core/models/quiz.model';
import { AppIconComponent } from '../../components/icon/icon.component';

type Screen = 'intro' | 'quiz' | 'result';

@Component({
  selector: 'app-style-quiz',
  standalone: true,
  imports: [CommonModule, RouterLink, AppIconComponent],
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
  readonly rewardAmount = 30;

  constructor(
    private quizService: QuizService,
    public coinService: CoinService,
    public authService: AuthService,
    public loginModalService: LoginModalService
  ) {}

  get questions() {
    return this.quizService.questions;
  }

  get currentQuestion() {
    return this.questions[this.currentIndex];
  }

  get progress(): number {
    return ((this.currentIndex) / this.questions.length) * 100;
  }

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
    this.result = this.quizService.computeResult(this.answers);
    this.screen = 'result';
    this.attemptId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
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
      await this.coinService.claim('STYLE_QUIZ', this.attemptId);
      this.coinClaimed = true;
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
    this.resetCoinState();
  }
}
