import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { QuizQuestion, QuizResult, StyleTag } from '../models/quiz.model';
import { AdminAuthService } from './admin-auth.service';
import { environment } from '../../../environments/environment';

const BASE = `${environment.apiUrl}/style-quiz`;

export type QuizQuestionInput = Partial<Omit<QuizQuestion, 'id'>>;

/** Câu hỏi & kết quả của Trắc nghiệm phong cách trên cửa hàng (/style-quiz). */
@Injectable({
  providedIn: 'root'
})
export class QuizService {
  private http = inject(HttpClient);
  private adminAuth = inject(AdminAuthService);

  private questionsSignal = signal<QuizQuestion[]>([]);
  private resultsSignal = signal<QuizResult[]>([]);
  readonly questions = this.questionsSignal.asReadonly();
  readonly results = this.resultsSignal.asReadonly();

  refresh(): void {
    this.http.get<{ success: boolean; questions: QuizQuestion[]; results: QuizResult[] }>(`${BASE}/admin`, {
      params: { adminId: this.adminAuth.adminId },
    }).subscribe({
      next: (res) => {
        if (!res.success) return;
        this.questionsSignal.set(res.questions);
        this.resultsSignal.set(res.results);
      },
      error: (err) => console.warn('Failed to load style quiz', err),
    });
  }

  createQuestion(data: QuizQuestionInput): Observable<QuizQuestion> {
    return this.http.post<{ success: boolean; question: QuizQuestion }>(`${BASE}/questions`, { ...data, adminId: this.adminAuth.adminId }).pipe(
      map(res => res.question),
      tap(question => this.questionsSignal.update(list => [...list, question]))
    );
  }

  updateQuestion(id: number, data: QuizQuestionInput): Observable<QuizQuestion> {
    return this.http.put<{ success: boolean; question: QuizQuestion }>(`${BASE}/questions/${id}`, { ...data, adminId: this.adminAuth.adminId }).pipe(
      map(res => res.question),
      tap(question => this.questionsSignal.update(list => list.map(q => q.id === id ? question : q)))
    );
  }

  deleteQuestion(id: number): Observable<void> {
    return this.http.delete<{ success: boolean }>(`${BASE}/questions/${id}`, {
      body: { adminId: this.adminAuth.adminId },
    }).pipe(
      map(() => undefined),
      tap(() => this.questionsSignal.update(list => list.filter(q => q.id !== id)))
    );
  }

  updateResult(tag: StyleTag, data: Omit<QuizResult, 'tag'>): Observable<QuizResult> {
    return this.http.put<{ success: boolean; result: QuizResult }>(`${BASE}/results/${tag}`, { ...data, adminId: this.adminAuth.adminId }).pipe(
      map(res => res.result),
      tap(result => this.resultsSignal.update(list => list.map(r => r.tag === tag ? result : r)))
    );
  }
}
