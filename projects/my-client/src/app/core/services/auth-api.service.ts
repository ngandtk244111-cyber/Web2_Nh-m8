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
 */
@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private http = inject(HttpClient);

  registerOtp(phoneNumber: string): Observable<AuthApiResponse> {
    return this.http.post<AuthApiResponse>(`${BASE}/register-otp`, { phoneNumber });
  }

  verifyOtpAny(phoneNumber: string, otp: string): Observable<AuthApiResponse> {
    return this.http.post<AuthApiResponse>(`${BASE}/verify-otp-any`, { phoneNumber, otp });
  }

  register(phoneNumber: string, password: string): Observable<AuthApiResponse> {
    return this.http.post<AuthApiResponse>(`${BASE}/register`, { phoneNumber, password });
  }

  login(phoneNumber: string, password: string): Observable<AuthApiResponse> {
    return this.http.post<AuthApiResponse>(`${BASE}/login`, { phoneNumber, password });
  }

  forgotPassword(phoneNumber: string): Observable<AuthApiResponse> {
    return this.http.post<AuthApiResponse>(`${BASE}/forgot-password`, { phoneNumber });
  }

  verifyOtp(phoneNumber: string, otp: string): Observable<AuthApiResponse> {
    return this.http.post<AuthApiResponse>(`${BASE}/verify-otp`, { phoneNumber, otp });
  }

  resetPassword(phoneNumber: string, newPassword: string): Observable<AuthApiResponse> {
    return this.http.post<AuthApiResponse>(`${BASE}/reset-password`, { phoneNumber, newPassword });
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
