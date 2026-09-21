import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { AppIconComponent } from '../../../components/icon/icon.component';

@Component({
  selector: 'app-account-profile-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, AppIconComponent],
  templateUrl: './profile-tab.component.html',
  styleUrl: './profile-tab.component.css'
})
export class ProfileTabComponent {
  @ViewChild('avatarInput') avatarInput?: ElementRef<HTMLInputElement>;

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

  triggerAvatarPicker(): void {
    this.avatarInput?.nativeElement.click();
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

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
    input.value = '';
  }

  saveProfile(): void {
    this.isSaving = true;
    this.authService.updateProfile({
      fullName: this.fullName,
      email: this.email,
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
