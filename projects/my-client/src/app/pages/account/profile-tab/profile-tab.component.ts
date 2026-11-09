import { Component, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { AppIconComponent } from '../../../components/icon/icon.component';
import { AvatarCropperComponent } from '../../../components/avatar-cropper/avatar-cropper.component';

@Component({
  selector: 'app-account-profile-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, AppIconComponent, AvatarCropperComponent],
  templateUrl: './profile-tab.component.html',
  styleUrl: './profile-tab.component.css'
})
export class ProfileTabComponent implements OnDestroy {

  fullName = '';
  email = '';
  gender: 'male' | 'female' | 'other' | '' = '';
  dateOfBirth = '';
  isSaving = false;
  isUploadingAvatar = false;

  constructor(
    public authService: AuthService,
    private toastService: ToastService
  ) {
    const user = this.authService.currentUser();
    if (user) {
      this.fullName = user.fullName || '';
      this.email = user.email || '';
      this.gender = user.gender || '';
      this.dateOfBirth = user.dateOfBirth || '';
    }
  }

  /* ---------- Liên kết / đổi số điện thoại (xác nhận bằng OTP) ---------- */
  phoneStep: 'idle' | 'enter' | 'otp' = 'idle';
  newPhone = '';
  phoneOtp = '';
  phoneError = '';
  phoneBusy = false;
  resendIn = 0;
  private resendTimer: ReturnType<typeof setInterval> | null = null;

  startPhoneLink(): void {
    this.phoneStep = 'enter';
    this.newPhone = '';
    this.phoneOtp = '';
    this.phoneError = '';
  }

  backToPhoneInput(): void {
    this.phoneStep = 'enter';
    this.phoneOtp = '';
    this.phoneError = '';
    this.stopResendTimer();
  }

  cancelPhoneLink(): void {
    this.phoneStep = 'idle';
    this.phoneError = '';
    this.stopResendTimer();
  }

  sendPhoneOtp(): void {
    const phone = this.newPhone.replace(/\s+/g, '');
    if (!/^0\d{9}$/.test(phone)) {
      this.phoneError = 'Số điện thoại gồm 10 số, bắt đầu bằng 0 (VD: 0912345678)';
      return;
    }
    this.newPhone = phone;
    this.phoneBusy = true;
    this.authService.requestPhoneOtp(phone).subscribe({
      next: (res) => {
        this.phoneBusy = false;
        this.phoneStep = 'otp';
        this.phoneOtp = '';
        this.startResendTimer();
        this.toastService.success('Đã gửi mã OTP tới ' + phone);
        // Chưa có nhà mạng gửi SMS thật: giả lập tin nhắn về máy — tự điền mã sau ~1s, khách bấm xác nhận.
        if (res.devOtp) {
          const code = res.devOtp;
          setTimeout(() => {
            if (this.phoneStep === 'otp' && !this.phoneOtp) this.phoneOtp = code;
          }, 1000);
        }
      },
      error: (err) => {
        this.phoneBusy = false;
        this.phoneError = err?.error?.error || 'Không gửi được mã, vui lòng thử lại';
      },
    });
  }

  confirmPhoneOtp(): void {
    const otp = this.phoneOtp.trim();
    if (!otp) {
      this.phoneError = 'Vui lòng nhập mã OTP';
      return;
    }
    this.phoneBusy = true;
    this.authService.verifyPhone(this.newPhone, otp).subscribe({
      next: () => {
        this.phoneBusy = false;
        this.cancelPhoneLink();
        this.toastService.success('Đã liên kết số điện thoại ' + this.newPhone);
      },
      error: (err) => {
        this.phoneBusy = false;
        this.phoneError = err?.error?.error || 'Không xác nhận được, vui lòng thử lại';
      },
    });
  }

  private startResendTimer(): void {
    this.stopResendTimer();
    this.resendIn = 60;
    this.resendTimer = setInterval(() => {
      this.resendIn--;
      if (this.resendIn <= 0) this.stopResendTimer();
    }, 1000);
  }

  private stopResendTimer(): void {
    if (this.resendTimer) clearInterval(this.resendTimer);
    this.resendTimer = null;
    this.resendIn = 0;
  }

  ngOnDestroy(): void {
    this.stopResendTimer();
  }

  /** Hộp xem ảnh đại diện phóng to. */
  viewerOpen = false;

  openViewer(): void {
    this.viewerOpen = true;
  }

  @HostListener('document:keydown.escape')
  closeViewer(): void {
    this.viewerOpen = false;
  }

  /** Hộp chụp/tải ảnh + cắt khung tròn. */
  cropperOpen = false;

  triggerAvatarPicker(): void {
    this.viewerOpen = false;
    this.cropperOpen = true;
  }

  /** Nhận ảnh đã cắt (JPEG vuông 512px) từ hộp cắt rồi tải lên. */
  onAvatarCropped(file: File): void {
    this.cropperOpen = false;
    this.isUploadingAvatar = true;
    this.authService.uploadAvatar(file).subscribe({
      next: () => {
        this.isUploadingAvatar = false;
        this.toastService.success('Đã cập nhật ảnh đại diện');
      },
      error: () => {
        this.isUploadingAvatar = false;
        this.toastService.error('Không tải được ảnh, vui lòng thử lại');
      },
    });
  }

  emailError = '';

  /** Email không bắt buộc, nhưng đã nhập thì phải đúng định dạng (vd ten@gmail.com). */
  validateEmail(): boolean {
    const value = this.email.trim();
    this.emailError = value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)
      ? 'Email không đúng định dạng, ví dụ: ten@gmail.com'
      : '';
    return !this.emailError;
  }

  saveProfile(): void {
    if (!this.validateEmail()) {
      this.toastService.error(this.emailError);
      return;
    }
    this.isSaving = true;
    this.authService.updateProfile({
      fullName: this.fullName,
      email: this.email.trim(),
      gender: this.gender,
      dateOfBirth: this.dateOfBirth,
    }).subscribe({
      next: () => {
        this.isSaving = false;
        this.toastService.success('Đã lưu thông tin tài khoản');
      },
      error: () => {
        this.isSaving = false;
        this.toastService.error('Không lưu được, vui lòng thử lại');
      },
    });
  }
}
