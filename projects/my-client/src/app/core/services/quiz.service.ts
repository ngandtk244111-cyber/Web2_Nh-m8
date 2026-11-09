import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DecorStyleTag, QuizQuestion, StyleResult } from '../models/quiz.model';
import { STYLE_QUIZ_QUESTIONS, STYLE_QUIZ_RESULTS } from '../data/quiz-data';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class QuizService {
  private http = inject(HttpClient);

  /** Bộ câu hỏi do nhân viên sửa ở my-admin; tải chưa xong / lỗi thì dùng bản dự phòng trong code. */
  questions: QuizQuestion[] = STYLE_QUIZ_QUESTIONS;
  private results: StyleResult[] = STYLE_QUIZ_RESULTS;

  constructor() {
    this.http.get<{ success: boolean; questions: QuizQuestion[]; results: StyleResult[] }>(`${environment.apiUrl}/style-quiz`).subscribe({
      next: (res) => {
        if (res.success && res.questions.length > 0) this.questions = res.questions;
        if (res.success && res.results.length > 0) this.results = res.results;
      },
      error: (err) => console.warn('Failed to load style quiz, using default questions', err),
    });
  }

  computeResult(answers: Record<number, DecorStyleTag>): StyleResult {
    const winningTag = this.computeScores(answers)[0].tag;
    return this.results.find(r => r.tag === winningTag) || this.results[0];
  }

  /** Tỉ lệ % từng phong cách theo đáp án, cao nhất trước (hoà điểm giữ thứ tự cố định). */
  computeScores(answers: Record<number, DecorStyleTag>): { tag: DecorStyleTag; percent: number }[] {
    const tally: Record<DecorStyleTag, number> = {
      minimalist: 0,
      scandinavian: 0,
      industrial: 0,
      bohemian: 0,
    };

    for (const tag of Object.values(answers)) {
      if (tag in tally) tally[tag]++;
    }

    const total = Object.values(tally).reduce((a, b) => a + b, 0) || 1;
    return (Object.keys(tally) as DecorStyleTag[])
      .map(tag => ({ tag, percent: Math.round((tally[tag] / total) * 100) }))
      .sort((a, b) => b.percent - a.percent);
  }
}
