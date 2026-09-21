import { AfterViewChecked, Component, ElementRef, QueryList, ViewChild, ViewChildren, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { AuthApiService } from '../../core/services/auth-api.service';
import { LoginModalService } from '../../core/services/login-modal.service';
import { ToastService } from '../../core/services/toast.service';
import { AppIconComponent } from '../icon/icon.component';
import { environment } from '../../../environments/environment';

declare const google: any;

type Mode = 'login' | 'register' | 'forgot-password' | 'google-phone';


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
  /** register: 1 = nhập SĐT, 2 = nhập OTP, 3 = đặt mật khẩu */
  registerStep: 1 | 2 | 3 = 1;
  /** forgot-password: 1 = nhập SĐT, 2 = nhập OTP, 3 = đặt mật khẩu mới */
  forgotStep: 1 | 2 | 3 = 1;

  phoneNumber = '';
  password = '';
  confirmPassword = '';
  otpCode = '';
  isSubmitting = false;
  showPassword = false;
  showConfirmPassword = false;

  errors: { phone?: string; password?: string; confirmPassword?: string; otp?: string } = {};

  otpTimer = 60;
  private otpInterval: ReturnType<typeof setInterval> | null = null;

  /** userId của tài khoản Google vừa đăng nhập lần đầu, đang chờ gắn SĐT (mode 'google-phone'). */
  pendingGoogleUserId: string | null = null;

  constructor(
    public modalService: LoginModalService,
    private authService: AuthService,
    private authApi: AuthApiService,
    private toastService: ToastService
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
    this.phoneNumber = '';
    this.password = '';
    this.confirmPassword = '';
    this.otpCode = '';
    this.isSubmitting = false;
    this.errors = {};
    this.pendingGoogleUserId = null;
    this.stopOtpTimer();
  }

  /**
   * `<div #googleBtnContainer>` chỉ tồn tại trong DOM khi modal đang mở VÀ mode === 'login'
   * (bị *ngIf huỷ/tạo lại mỗi lần đóng/mở modal), nên không thể chỉ render 1 lần ở
   * ngAfterViewInit — phải kiểm tra lại mỗi lần view check và render lại vào container mới
   * mỗi khi nó xuất hiện rỗng (chưa có nút Google bên trong).
   */
  ngAfterViewChecked(): void {
    const container = this.googleBtnContainer?.nativeElement;
    if (container && !container.hasChildNodes()) {
      this.renderGoogleButton();
    }
  }

  /** Google Identity Services script tải async — chờ tới khi `window.google` sẵn sàng rồi mới render nút. */
  private renderGoogleButton(retriesLeft = 20): void {
    if (typeof google === 'undefined' || !google?.accounts?.id) {
      if (retriesLeft <= 0) return;
      setTimeout(() => this.renderGoogleButton(retriesLeft - 1), 250);
      return;
    }
    const container = this.googleBtnContainer?.nativeElement;
    if (!container) return;
    google.accounts.id.initialize({
      client_id: environment.googleClientId,
      callback: (response: { credential: string }) => this.handleGoogleCredential(response.credential),
    });
    google.accounts.id.renderButton(container, {
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      text: 'continue_with',
      width: 220,
    });
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
      if (this.forgotStep === 1) return 'Quên Mật Khẩu';
      if (this.forgotStep === 2) return 'Nhập Mã OTP';
      return 'Đặt Mật Khẩu Mới';
    }
    if (this.mode === 'google-phone') {
      return this.registerStep === 1 ? 'Hoàn Tất Đăng Nhập Google' : 'Nhập Mã OTP';
    }
    if (this.mode === 'register') {
      if (this.registerStep === 1) return 'Đăng Ký Tài Khoản';
      if (this.registerStep === 2) return 'Nhập Mã OTP';
      return 'Tạo Mật Khẩu';
    }
    return 'Đăng Nhập Luméa';
  }

  // ---------- validate ----------
  private validatePhone(phone: string): boolean {
    return /^0\d{9}$/.test(phone.trim());
  }

  private passwordErrorMessage(password: string): string | null {
    if (!password || password.length < 8) return 'Mật khẩu cần tối thiểu 8 ký tự.';
    if (!/[A-Z]/.test(password)) return 'Mật khẩu cần tối thiểu 1 chữ in hoa.';
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) return 'Mật khẩu cần tối thiểu 1 ký tự đặc biệt.';
    return null;
  }

  get isOtpValid(): boolean {
    return this.otpCode.length === 6 && /^\d+$/.test(this.otpCode);
  }

  // ---------- OTP 6-ô ----------
  onOtpKeypress(e: KeyboardEvent): void {
    const allowed = ['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'Delete'];
    if (!/^\d$/.test(e.key) && !allowed.includes(e.key)) e.preventDefault();
  }

  onOtpDigitChange(val: string, index: number): void {
    const digits = val.replace(/\D/g, '');
    const arr = [...this.otpCode.split('')];
    while (arr.length < 6) arr.push('');
    if (digits.length > 1) {
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
    this.otpTimer = 60;
    this.otpInterval = setInterval(() => {
      this.otpTimer--;
      if (this.otpTimer <= 0) this.stopOtpTimer();
    }, 1000);
  }

  private stopOtpTimer(): void {
    if (this.otpInterval) {
      clearInterval(this.otpInterval);
      this.otpInterval = null;
    }
  }

  // ---------- chuyển chế độ ----------
  switchToRegister(): void {
    this.mode = 'register';
    this.registerStep = 1;
    this.errors = {};
  }

  switchToLogin(): void {
    this.mode = 'login';
    this.registerStep = 1;
    this.forgotStep = 1;
    this.stopOtpTimer();
    this.errors = {};
  }

  switchToForgotPassword(): void {
    this.mode = 'forgot-password';
    this.forgotStep = 1;
    this.errors = {};
  }

  // ---------- Đăng nhập ----------
  submitLogin(): void {
    this.errors = {};
    if (!this.validatePhone(this.phoneNumber)) {
      this.errors.phone = 'Số điện thoại không hợp lệ.';
      return;
    }
    if (!this.password) {
      this.errors.password = 'Vui lòng nhập mật khẩu.';
      return;
    }
    if (this.isSubmitting) return;
    this.isSubmitting = true;

    this.authApi.login(this.phoneNumber.trim(), this.password).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        if (res.success && res.user) {
          this.authService.setUser(res.user);
          this.toastService.success('Đăng nhập thành công!');
          this.close();
        } else {
          this.errors.password = res.error || 'Thông tin đăng nhập sai, vui lòng thử lại.';
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errors.password = err.error?.error || 'Thông tin đăng nhập sai, vui lòng thử lại.';
      },
    });
  }

  // ---------- Đăng ký ----------
  submitRegisterPhone(): void {
    this.errors = {};
    if (!this.validatePhone(this.phoneNumber)) {
      this.errors.phone = 'Số điện thoại không hợp lệ.';
      return;
    }
    if (this.isSubmitting) return;
    this.isSubmitting = true;

    this.authApi.registerOtp(this.phoneNumber.trim()).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        if (res.success) {
          this.registerStep = 2;
          this.otpCode = '';
          this.startOtpTimer();
          if (res.devOtp) this.toastService.info(`[DEV] Mã OTP: ${res.devOtp}`, 6000);
        } else {
          this.errors.phone = res.error || 'Không thể gửi mã OTP.';
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errors.phone = err.error?.error || 'Không thể kết nối tới máy chủ.';
      },
    });
  }

  submitRegisterOtp(): void {
    this.errors = { ...this.errors, otp: undefined };
    if (!this.isOtpValid) {
      this.errors.otp = 'Mã không đúng, yêu cầu nhập lại.';
      return;
    }
    if (this.otpTimer <= 0) {
      this.errors.otp = 'Hết thời gian, hãy yêu cầu gửi lại.';
      return;
    }
    if (this.isSubmitting) return;
    this.isSubmitting = true;

    this.authApi.verifyOtpAny(this.phoneNumber.trim(), this.otpCode).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        if (res.success) {
          this.otpCode = '';
          this.stopOtpTimer();
          if (this.mode === 'google-phone') {
            this.finishGoogleLogin();
          } else {
            this.registerStep = 3;
          }
        } else {
          this.errors.otp = res.error || 'Mã không đúng, yêu cầu nhập lại.';
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errors.otp = err.error?.error || 'Mã không đúng, yêu cầu nhập lại.';
      },
    });
  }

  resendRegisterOtp(): void {
    if (this.isSubmitting) return;
    this.submitRegisterPhone();
  }

  submitRegisterPassword(): void {
    this.errors = {};
    const passErr = this.passwordErrorMessage(this.password);
    if (passErr) {
      this.errors.password = passErr;
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.errors.confirmPassword = 'Mật khẩu nhập lại không khớp.';
      return;
    }
    if (this.isSubmitting) return;
    this.isSubmitting = true;

    this.authApi.register(this.phoneNumber.trim(), this.password).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        if (res.success && res.user) {
          this.authService.setUser(res.user);
          this.toastService.success('Đăng ký tài khoản thành công!');
          this.close();
        } else {
          this.errors.password = res.error || 'Đăng ký thất bại.';
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errors.password = err.error?.error || 'Không thể kết nối tới máy chủ.';
      },
    });
  }

  // ---------- Quên mật khẩu ----------
  submitForgotPhone(): void {
    this.errors = {};
    if (!this.validatePhone(this.phoneNumber)) {
      this.errors.phone = 'Số điện thoại không hợp lệ.';
      return;
    }
    if (this.isSubmitting) return;
    this.isSubmitting = true;

    this.authApi.forgotPassword(this.phoneNumber.trim()).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        if (res.success) {
          this.forgotStep = 2;
          this.otpCode = '';
          this.startOtpTimer();
          if (res.devOtp) this.toastService.info(`[DEV] Mã OTP: ${res.devOtp}`, 6000);
        } else {
          this.errors.phone = res.error || 'Số điện thoại chưa đăng ký.';
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errors.phone = err.error?.error || 'Không thể kết nối tới máy chủ.';
      },
    });
  }

  submitForgotOtp(): void {
    this.errors = { ...this.errors, otp: undefined };
    if (!this.isOtpValid) {
      this.errors.otp = 'Mã không đúng, yêu cầu nhập lại.';
      return;
    }
    if (this.otpTimer <= 0) {
      this.errors.otp = 'Hết thời gian, hãy yêu cầu gửi lại.';
      return;
    }
    if (this.isSubmitting) return;
    this.isSubmitting = true;

    this.authApi.verifyOtp(this.phoneNumber.trim(), this.otpCode).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        if (res.success) {
          this.forgotStep = 3;
          this.otpCode = '';
          this.stopOtpTimer();
        } else {
          this.errors.otp = res.error || 'Mã không đúng, yêu cầu nhập lại.';
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errors.otp = err.error?.error || 'Mã không đúng, yêu cầu nhập lại.';
      },
    });
  }

  resendForgotOtp(): void {
    if (this.isSubmitting) return;
    this.submitForgotPhone();
  }

  submitForgotNewPassword(): void {
    this.errors = {};
    const passErr = this.passwordErrorMessage(this.password);
    if (passErr) {
      this.errors.password = passErr;
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.errors.confirmPassword = 'Mật khẩu nhập lại không khớp.';
      return;
    }
    if (this.isSubmitting) return;
    this.isSubmitting = true;

    this.authApi.resetPassword(this.phoneNumber.trim(), this.password).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        if (res.success && res.user) {
          this.authService.setUser(res.user);
          this.toastService.success('Đổi mật khẩu thành công, bạn đã đăng nhập.');
          this.close();
        } else {
          this.errors.password = res.error || 'Không thể đổi mật khẩu.';
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errors.password = err.error?.error || 'Không thể kết nối tới máy chủ.';
      },
    });
  }

  // ---------- Đăng nhập Google ----------
  private handleGoogleCredential(credential: string): void {
    this.errors = {};
    this.authApi.loginWithGoogle(credential).subscribe({
      next: (res) => {
        if (res.success && res.needsPhone && res.userId) {
          this.pendingGoogleUserId = res.userId;
          this.mode = 'google-phone';
          this.registerStep = 1;
          this.phoneNumber = '';
        } else if (res.success && res.user) {
          this.authService.setUser(res.user);
          this.toastService.success('Đăng nhập Google thành công!');
          this.close();
        } else {
          this.toastService.error(res.error || 'Đăng nhập Google thất bại.');
        }
      },
      error: () => this.toastService.error('Không thể kết nối tới máy chủ.'),
    });
  }

  private finishGoogleLogin(): void {
    if (!this.pendingGoogleUserId) return;
    this.isSubmitting = true;
    this.authApi.attachGooglePhone(this.pendingGoogleUserId, this.phoneNumber.trim()).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        if (res.success && res.user) {
          this.authService.setUser(res.user);
          this.toastService.success('Đăng nhập Google thành công!');
          this.close();
        } else {
          this.errors.otp = res.error || 'Không thể hoàn tất đăng nhập.';
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errors.otp = err.error?.error || 'Không thể kết nối tới máy chủ.';
      },
    });
  }

  // ---------- Đăng nhập Facebook (chưa cấu hình provider thật) ----------
  onSocialLoginStub(provider: string): void {
    this.toastService.info(`Đăng nhập bằng ${provider} đang được phát triển.`);
  }
}
