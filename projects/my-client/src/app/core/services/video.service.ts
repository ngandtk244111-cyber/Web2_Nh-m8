import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

const BASE = `${environment.apiUrl}/videos`;

/** Video chủ đề do nhân viên đăng ở my-admin — server chỉ trả video đang bật, đã sắp thứ tự. */
export interface VideoItem {
  id: string;
  title: string;
  description: string;
  youtubeId: string;
  poster: string;
  link: string;
  ctaLabel: string;
}

@Injectable({
  providedIn: 'root'
})
export class VideoService {
  private http = inject(HttpClient);

  getVideos(): Observable<VideoItem[]> {
    return this.http.get<{ success: boolean; videos: VideoItem[] }>(BASE).pipe(
      map(res => (res.success ? res.videos : []))
    );
  }
}
