import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminAuthService } from '../../core/services/admin-auth.service';

/** Đăng nhập nhân viên — bố cục 2 cột như login/ của Vita (minh hoạ trái, thẻ đăng nhập phải). */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {
  private adminAuth = inject(AdminAuthService);
  private router = inject(Router);

  username = '';
  password = '';
  submitting = false;
  error = '';
  showPassword = false;

  ngOnInit(): void {
    // Đã đăng nhập thì vào thẳng Tổng quan (token hết hạn sẽ bị interceptor đưa lại về đây).
    if (this.adminAuth.currentAdmin() && this.adminAuth.token) this.router.navigate(['/dashboard']);
  }

  submit(): void {
    if (this.submitting) return;
    if (!this.username.trim() || !this.password.trim()) {
      this.error = 'Vui lòng nhập tên đăng nhập và mật khẩu';
      return;
    }

    this.submitting = true;
    this.error = '';

    this.adminAuth.login(this.username.trim(), this.password).subscribe({
      next: (res) => {
        this.submitting = false;
        if (res.success) {
          this.router.navigate(['/dashboard']);
        } else {
          this.error = res.error || 'Sai tên đăng nhập hoặc mật khẩu';
        }
      },
      error: (err) => {
        this.submitting = false;
        this.error = err?.error?.error || 'Không kết nối được tới server';
      },
    });
  }
}
