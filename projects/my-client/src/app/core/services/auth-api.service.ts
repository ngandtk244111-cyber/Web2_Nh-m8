import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoggedUser } from './auth.service';

const BASE = `${environment.apiUrl}/auth`;

export interface AuthApiResponse {
  success: boolean;
  user?: LoggedUser;
  message?: string;
  error?: string;
  devOtp?: string;
}

/**
 * Tách riêng phần gọi API khỏi state đăng nhập (AuthService) — tham khảo cấu trúc
 * AuthService/AuthApiService của VitaCare-main.
 *
 * `identifier` = số điện thoại (0xxxxxxxxx) HOẶC email — server tự nhận dạng (readContact ở
 * server/routes/authRoutes.js), dùng chung cho đăng ký, đăng nhập và quên mật khẩu.
 */
@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private http = inject(HttpClient);

  registerOtp(identifier: string): Observable<AuthApiResponse> {
    return this.http.post<AuthApiResponse>(`${BASE}/register-otp`, { identifier });
  }

  verifyOtpAny(identifier: string, otp: string): Observable<AuthApiResponse> {
    return this.http.post<AuthApiResponse>(`${BASE}/verify-otp-any`, { identifier, otp });
  }

  register(identifier: string, password: string): Observable<AuthApiResponse> {
    return this.http.post<AuthApiResponse>(`${BASE}/register`, { identifier, password });
  }

  login(identifier: string, password: string): Observable<AuthApiResponse> {
    return this.http.post<AuthApiResponse>(`${BASE}/login`, { identifier, password });
  }

  loginWithGoogle(credential: string): Observable<AuthApiResponse> {
    return this.http.post<AuthApiResponse>(`${BASE}/google`, { credential });
  }

  forgotPassword(identifier: string): Observable<AuthApiResponse> {
    return this.http.post<AuthApiResponse>(`${BASE}/forgot-password`, { identifier });
  }

  verifyOtp(identifier: string, otp: string): Observable<AuthApiResponse> {
    return this.http.post<AuthApiResponse>(`${BASE}/verify-otp`, { identifier, otp });
  }

  resetPassword(identifier: string, newPassword: string): Observable<AuthApiResponse> {
    return this.http.post<AuthApiResponse>(`${BASE}/reset-password`, { identifier, newPassword });
  }

  updateProfile(userId: string, payload: {
    fullName?: string;
    email?: string;
    address?: unknown;
    gender?: 'male' | 'female' | 'other' | '';
    dateOfBirth?: string;
  }): Observable<AuthApiResponse> {
    return this.http.put<AuthApiResponse>(`${BASE}/profile`, { userId, ...payload });
  }

  uploadAvatar(userId: string, file: File): Observable<AuthApiResponse> {
    const formData = new FormData();
    formData.append('userId', userId);
    formData.append('avatar', file);
    return this.http.post<AuthApiResponse>(`${BASE}/avatar`, formData);
  }
}
