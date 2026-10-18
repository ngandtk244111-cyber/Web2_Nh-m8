import { AfterViewChecked, Component, ElementRef, QueryList, ViewChild, ViewChildren, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { AuthApiResponse, AuthApiService } from '../../core/services/auth-api.service';
import { LoginModalService } from '../../core/services/login-modal.service';
import { ToastService } from '../../core/services/toast.service';
import { MascotService } from '../../core/services/mascot.service';
import { AppIconComponent } from '../icon/icon.component';
import { environment } from '../../../environments/environment';

declare const google: any;

type Mode = 'login' | 'register' | 'forgot-password';

const PHONE_REGEX = /^0\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_SECONDS = 60;

/**
 * Hộp thoại tài khoản — bố cục tham khảo VitaCare-main (features/accounts/auth): 3 luồng TÁCH RIÊNG
 *   - Đăng nhập: SĐT/email + mật khẩu (+ Google)
 *   - Đăng ký: SĐT/email → OTP 6 số → đặt mật khẩu
 *   - Quên mật khẩu: SĐT/email → OTP 6 số → mật khẩu mới
 * Server nhận chung 1 trường `identifier` là SĐT hoặc email (server/routes/authRoutes.js).
 */
@Component({
  selector: 'app-login-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, AppIconComponent],
  templateUrl: './login-modal.component.html',
  styleUrl: './login-modal.component.css'
})
export class LoginModalComponent implements AfterViewChecked {
  @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef<HTMLInputElement>>;
  @ViewChild('googleBtnContainer') googleBtnContainer!: ElementRef<HTMLDivElement>;

  mode: Mode = 'login';
  /** register: 1 = nhập SĐT/email, 2 = nhập OTP, 3 = đặt mật khẩu */
  registerStep: 1 | 2 | 3 = 1;
  /** forgot-password: 1 = nhập SĐT/email, 2 = nhập OTP, 3 = đặt mật khẩu mới */
  forgotStep: 1 | 2 | 3 = 1;

  /** Số điện thoại hoặc email. */
  identifier = '';
  password = '';
  confirmPassword = '';
  otpCode = '';
  private submitting = false;
  /** Mọi luồng gửi form đều đi qua cờ này -> đồng bộ luôn trạng thái loading của mascot tại đây. */
  get isSubmitting(): boolean {
    return this.submitting;
  }
  set isSubmitting(value: boolean) {
    if (value === this.submitting) return;
    this.submitting = value;
    if (value) this.mascotService.beginLoading({ immediate: true });
    else this.mascotService.endLoading();
  }
  showPassword = false;
  showConfirmPassword = false;

  errors: { identifier?: string; password?: string; confirmPassword?: string; otp?: string } = {};

  otpTimer = OTP_SECONDS;
  private otpInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    public modalService: LoginModalService,
    private authService: AuthService,
    private authApi: AuthApiService,
    private toastService: ToastService,
    public mascotService: MascotService
  ) {
    effect(() => {
      if (this.modalService.isOpen()) {
        this.resetAll();
      }
    });
  }

  private resetAll(): void {
    this.mode = 'login';
    this.registerStep = 1;
    this.forgotStep = 1;
    this.identifier = '';
    this.resetSecrets();
    this.isSubmitting = false;
    this.errors = {};
    this.stopOtpTimer();
  }

  private resetSecrets(): void {
    this.password = '';
    this.confirmPassword = '';
    this.otpCode = '';
    this.showPassword = false;
    this.showConfirmPassword = false;
  }

  /**
   * `<div #googleBtnContainer>` chỉ tồn tại khi modal mở VÀ đang ở màn đăng nhập (bị *ngIf huỷ/tạo
   * lại), nên kiểm tra lại mỗi lần view check và render vào container mới khi nó còn rỗng.
   */
  ngAfterViewChecked(): void {
    const container = this.googleBtnContainer?.nativeElement;
    if (container && !container.hasChildNodes() && !this.googleRenderPending) {
      this.renderGoogleButton();
    }
  }

  /** Đang chờ thư viện Google tải — tránh mỗi lần view check lại đẻ thêm một chuỗi setTimeout. */
  private googleRenderPending = false;

  /**
   * Google Identity Services tải async — chờ `window.google` sẵn sàng rồi render nút chuẩn (rộng bằng khung)
   * vào lớp trong suốt phủ trên mặt nút tự vẽ.
   */
  private renderGoogleButton(retriesLeft = 20): void {
    if (typeof google === 'undefined' || !google?.accounts?.id) {
      if (retriesLeft <= 0) { this.googleRenderPending = false; return; }
      this.googleRenderPending = true;
      setTimeout(() => this.renderGoogleButton(retriesLeft - 1), 250);
      return;
    }
    this.googleRenderPending = false;
    const container = this.googleBtnContainer?.nativeElement;
    if (!container) return;
    google.accounts.id.initialize({
      client_id: environment.googleClientId,
      callback: (response: { credential: string }) => this.handleGoogleCredential(response.credential),
    });
    google.accounts.id.renderButton(container, {
      type: 'standard', theme: 'outline', size: 'large', text: 'signin_with', locale: 'vi',
      width: Math.min(400, Math.max(200, container.offsetWidth || 320)),
    });
  }

  /** Click rơi xuống mặt nút tự vẽ = nút thật của Google chưa có (script bị chặn / mất mạng). */
  onGoogleFallbackClick(): void {
    this.toastService.error('Chưa kết nối được tới Google, vui lòng tải lại trang hoặc đăng nhập bằng SĐT/email.');
    this.renderGoogleButton();
  }

  close(): void {
    this.modalService.close();
    this.resetAll();
  }

  onBackdropClick(ev: MouseEvent): void {
    if (ev.target === ev.currentTarget) this.close();
  }

  get title(): string {
    if (this.mode === 'forgot-password') {
      if (this.forgotStep === 1) return 'Quên mật khẩu';
      if (this.forgotStep === 2) return 'Nhập mã OTP';
      return 'Đặt mật khẩu mới';
    }
    if (this.mode === 'register') {
      if (this.registerStep === 1) return 'Đăng ký tài khoản';
      if (this.registerStep === 2) return 'Nhập mã OTP';
      return 'Tạo mật khẩu';
    }
    return 'Đăng nhập';
  }

  /** Đang ở bước nhập OTP (của đăng ký hoặc quên mật khẩu) — hiện nút "Quay lại". */
  get isOtpStep(): boolean {
    return (this.mode === 'register' && this.registerStep === 2) || (this.mode === 'forgot-password' && this.forgotStep === 2);
  }

  // ---------- validate ----------
  private get cleanIdentifier(): string {
    const v = this.identifier.trim();
    return EMAIL_REGEX.test(v) ? v.toLowerCase() : v.replace(/\s/g, '');
  }

  private validateIdentifier(): boolean {
    const v = this.cleanIdentifier;
    if (!v) {
      this.errors.identifier = 'Vui lòng nhập số điện thoại hoặc email.';
      return false;
    }
    if (!PHONE_REGEX.test(v) && !EMAIL_REGEX.test(v)) {
      this.errors.identifier = 'Số điện thoại (10 số, bắt đầu bằng 0) hoặc email không hợp lệ.';
      return false;
    }
    return true;
  }

  /** "số điện thoại 0912…" / "email ten@…" — dùng trong câu "Mã OTP đã được gửi đến …". */
  get identifierLabel(): string {
    return EMAIL_REGEX.test(this.cleanIdentifier) ? `email ${this.cleanIdentifier}` : `số điện thoại ${this.cleanIdentifier}`;
  }

  private passwordErrorMessage(password: string): string | null {
    if (!password || password.length < 8) return 'Mật khẩu cần tối thiểu 8 ký tự.';
    if (!/[A-Z]/.test(password)) return 'Mật khẩu cần tối thiểu 1 chữ in hoa.';
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) return 'Mật khẩu cần tối thiểu 1 ký tự đặc biệt.';
    return null;
  }

  private validateNewPassword(): boolean {
    const passErr = this.passwordErrorMessage(this.password);
    if (passErr) {
      this.errors.password = passErr;
      return false;
    }
    if (this.password !== this.confirmPassword) {
      this.errors.confirmPassword = 'Mật khẩu nhập lại không khớp.';
      return false;
    }
    return true;
  }

  get isOtpValid(): boolean {
    return this.otpCode.length === 6 && /^\d+$/.test(this.otpCode);
  }

  // ---------- OTP 6 ô ----------
  onOtpKeypress(e: KeyboardEvent, index: number): void {
    if (e.key === 'Backspace' && !this.otpCode[index] && index > 0) {
      this.otpInputs?.get(index - 1)?.nativeElement?.focus();
      return;
    }
    const allowed = ['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'Delete', 'Enter'];
    if (!/^\d$/.test(e.key) && !allowed.includes(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault();
  }

  onOtpDigitChange(val: string, index: number): void {
    const digits = val.replace(/\D/g, '');
    const arr = [...this.otpCode.split('')];
    while (arr.length < 6) arr.push('');
    if (digits.length > 1) {
      // Dán cả mã 6 số vào 1 ô.
      for (let j = 0; j < Math.min(digits.length, 6); j++) arr[j] = digits[j];
      this.otpCode = arr.join('').slice(0, 6);
      const nextIdx = Math.min(digits.length, 6) - 1;
      setTimeout(() => this.otpInputs?.get(nextIdx)?.nativeElement?.focus(), 0);
    } else {
      const digit = digits.slice(-1);
      arr[index] = digit;
      this.otpCode = arr.join('').slice(0, 6);
      if (digit && index < 5) {
        setTimeout(() => this.otpInputs?.get(index + 1)?.nativeElement?.focus(), 0);
      }
    }
    this.errors = { ...this.errors, otp: undefined };
  }

  private startOtpTimer(): void {
    this.stopOtpTimer();
    this.otpTimer = OTP_SECONDS;
    this.otpInterval = setInterval(() => {
      this.otpTimer--;
      if (this.otpTimer <= 0) this.stopOtpTimer();
    }, 1000);
    setTimeout(() => this.otpInputs?.first?.nativeElement?.focus(), 50);
  }

  private stopOtpTimer(): void {
    if (this.otpInterval) {
      clearInterval(this.otpInterval);
      this.otpInterval = null;
    }
  }

  // ---------- chuyển màn ----------
  switchToRegister(): void {
    this.mode = 'register';
    this.registerStep = 1;
    this.resetSecrets();
    this.stopOtpTimer();
    this.errors = {};
  }

  switchToLogin(): void {
    this.mode = 'login';
    this.registerStep = 1;
    this.forgotStep = 1;
    this.resetSecrets();
    this.stopOtpTimer();
    this.errors = {};
  }

  switchToForgotPassword(): void {
    this.mode = 'forgot-password';
    this.forgotStep = 1;
    this.resetSecrets();
    this.errors = {};
  }

  /** Từ bước OTP quay lại bước nhập SĐT/email. */
  backFromOtp(): void {
    this.stopOtpTimer();
    this.otpCode = '';
    this.errors = {};
    if (this.mode === 'register') this.registerStep = 1;
    else this.forgotStep = 1;
  }

  // ---------- helper gọi API ----------
  private run(
    call: Observable<AuthApiResponse>,
    field: keyof LoginModalComponent['errors'],
    fallback: string,
    onSuccess: (res: AuthApiResponse) => void,
  ): void {
    if (this.isSubmitting) return;
    this.isSubmitting = true;
    call.subscribe({
      next: (res) => {
        this.isSubmitting = false;
        if (res.success) onSuccess(res);
        else {
          this.errors = { ...this.errors, [field]: res.error || fallback };
          this.mascotService.react('sad');
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errors = { ...this.errors, [field]: err.error?.error || fallback };
        this.mascotService.react('sad');
      },
    });
  }

  private loggedIn(res: AuthApiResponse, message: string): void {
    if (!res.user) return;
    this.authService.setUser(res.user);
    this.toastService.success(message);
    this.mascotService.react('happy');
    this.close();
  }

  private otpSent(res: AuthApiResponse): void {
    this.otpCode = '';
    this.startOtpTimer();
    if (res.devOtp) this.toastService.info(`[DEV] Mã OTP: ${res.devOtp}`, 8000);
  }

  // ---------- Đăng nhập ----------
  submitLogin(): void {
    this.errors = {};
    if (!this.validateIdentifier()) return;
    if (!this.password) {
      this.errors.password = 'Vui lòng nhập mật khẩu.';
      return;
    }
    this.run(this.authApi.login(this.cleanIdentifier, this.password), 'password',
      'Thông tin đăng nhập sai, vui lòng thử lại.', (res) => this.loggedIn(res, 'Đăng nhập thành công!'));
  }

  // ---------- Đăng ký ----------
  submitRegisterIdentifier(): void {
    this.errors = {};
    if (!this.validateIdentifier()) return;
    this.run(this.authApi.registerOtp(this.cleanIdentifier), 'identifier', 'Không thể gửi mã OTP.', (res) => {
      this.registerStep = 2;
      this.otpSent(res);
    });
  }

  submitRegisterOtp(): void {
    this.errors = {};
    if (!this.isOtpValid) {
      this.errors.otp = 'Vui lòng nhập đủ 6 chữ số.';
      return;
    }
    if (this.otpTimer <= 0) {
      this.errors.otp = 'Mã đã hết hiệu lực, hãy gửi lại mã mới.';
      return;
    }
    this.run(this.authApi.verifyOtpAny(this.cleanIdentifier, this.otpCode), 'otp', 'Mã OTP không đúng.', () => {
      this.stopOtpTimer();
      this.otpCode = '';
      this.registerStep = 3;
    });
  }

  submitRegisterPassword(): void {
    this.errors = {};
    if (!this.validateNewPassword()) return;
    this.run(this.authApi.register(this.cleanIdentifier, this.password), 'password', 'Đăng ký thất bại.',
      (res) => this.loggedIn(res, 'Đăng ký tài khoản thành công!'));
  }

  // ---------- Quên mật khẩu ----------
  submitForgotIdentifier(): void {
    this.errors = {};
    if (!this.validateIdentifier()) return;
    this.run(this.authApi.forgotPassword(this.cleanIdentifier), 'identifier', 'Không thể gửi mã OTP.', (res) => {
      this.forgotStep = 2;
      this.otpSent(res);
    });
  }

  submitForgotOtp(): void {
    this.errors = {};
    if (!this.isOtpValid) {
      this.errors.otp = 'Vui lòng nhập đủ 6 chữ số.';
      return;
    }
    if (this.otpTimer <= 0) {
      this.errors.otp = 'Mã đã hết hiệu lực, hãy gửi lại mã mới.';
      return;
    }
    this.run(this.authApi.verifyOtp(this.cleanIdentifier, this.otpCode), 'otp', 'Mã OTP không đúng.', () => {
      this.stopOtpTimer();
      this.otpCode = '';
      this.forgotStep = 3;
    });
  }

  submitForgotNewPassword(): void {
    this.errors = {};
    if (!this.validateNewPassword()) return;
    this.run(this.authApi.resetPassword(this.cleanIdentifier, this.password), 'password', 'Không thể đổi mật khẩu.',
      (res) => this.loggedIn(res, 'Đổi mật khẩu thành công, bạn đã đăng nhập.'));
  }

  /** Gửi lại mã ở bước OTP (đăng ký hoặc quên mật khẩu). */
  resendOtp(): void {
    if (this.mode === 'register') this.submitRegisterIdentifier();
    else this.submitForgotIdentifier();
  }

  submitOtp(): void {
    if (this.mode === 'register') this.submitRegisterOtp();
    else this.submitForgotOtp();
  }

  // ---------- Mạng xã hội ----------
  private handleGoogleCredential(credential: string): void {
    this.errors = {};
    this.run(this.authApi.loginWithGoogle(credential), 'password', 'Đăng nhập Google thất bại.',
      (res) => this.loggedIn(res, 'Đăng nhập Google thành công!'));
  }
}
