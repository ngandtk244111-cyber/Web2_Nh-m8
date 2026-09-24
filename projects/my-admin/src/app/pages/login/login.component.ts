import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminAuthService } from '../../core/services/admin-auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  username = '';
  password = '';
  submitting = false;
  error = '';

  constructor(private adminAuth: AdminAuthService, private router: Router) {}

  submit(): void {
    if (!this.username.trim() || !this.password.trim() || this.submitting) return;

    this.submitting = true;
    this.error = '';

    this.adminAuth.login(this.username.trim(), this.password).subscribe({
      next: (res) => {
        this.submitting = false;
        if (res.success) {
          this.router.navigate(['/']);
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

  fillDemo(u: string, p: string): void {
    this.username = u;
    this.password = p;
    this.error = '';
  }
}
