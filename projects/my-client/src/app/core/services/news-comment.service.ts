import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, of, switchMap } from 'rxjs';
import { NewsComment } from '../models/news.model';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { LoginModalService } from './login-modal.service';
import { UserDataService } from './user-data.service';

const BASE = `${environment.apiUrl}/news`;

@Injectable({ providedIn: 'root' })
export class NewsCommentService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private login = inject(LoginModalService);
  private userData = inject(UserDataService);

  list(articleId: string): Observable<NewsComment[]> {
    return this.userData.importSocial().pipe(
      switchMap(() => this.http.get<{ success: boolean; comments: NewsComment[] }>(`${BASE}/${articleId}/comments`)),
      map(res => res.success ? res.comments : [])
    );
  }

  add(articleId: string, userId: string, text: string, parentId: string | null = null): Observable<NewsComment> {
    return this.http.post<{ comment: NewsComment }>(`${BASE}/${articleId}/comments`, { userId, text, parentId }).pipe(map(res => res.comment));
  }

  toggleLike(comment: NewsComment): Observable<NewsComment> {
    if (!this.auth.currentUser()) { this.login.open(); return of(comment); }
    const action = comment.isLiked ? 'unlike' : 'like';
    return this.http.post<{ comment: NewsComment }>(`${BASE}/comments/${comment.id}/${action}`, {}).pipe(map(res => res.comment));
  }
}
