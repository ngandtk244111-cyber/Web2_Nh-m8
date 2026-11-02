import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

const BASE = `${environment.apiUrl}/banners`;

/** Phần admin đã sửa của 1 vị trí banner; trường không có thì giữ nội dung gốc trong code. */
export interface BannerOverride {
  active?: boolean;
  imageUrl?: string;
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  ctaText?: string;
  ctaLink?: string;
  code?: string;
  videoUrl?: string;
  line1?: string;
  line2?: string;
  tickerLabel?: string;
}

export type BannerOverrides = Record<string, BannerOverride>;

export interface BannerLink {
  link: string;
  queryParams?: Record<string, string>;
}

@Injectable({
  providedIn: 'root'
})
export class BannerService {
  private http = inject(HttpClient);

  /** Rỗng cho tới khi server trả về hoặc khi lỗi, nên giao diện luôn có nội dung gốc để hiện. */
  readonly overrides = signal<BannerOverrides>({});

  readonly loaded$: Observable<BannerOverrides> = this.http
    .get<{ success: boolean; banners: BannerOverrides }>(BASE)
    .pipe(
      map(res => res.banners || {}),
      catchError(() => of<BannerOverrides>({})),
      tap(banners => this.overrides.set(banners)),
      shareReplay(1)
    );

  constructor() {
    this.loaded$.subscribe();
  }

  /** Tách link admin nhập (vd. /catalog?sale=1) vì routerLink không nhận query nằm chung trong đường dẫn. */
  splitLink(url: string): BannerLink {
    const [link, query] = url.split('?');
    if (!query) return { link };
    return { link, queryParams: Object.fromEntries(new URLSearchParams(query)) };
  }
}
