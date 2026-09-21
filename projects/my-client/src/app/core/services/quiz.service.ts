import { Injectable } from '@angular/core';
import { DecorStyleTag, QuizQuestion, StyleResult } from '../models/quiz.model';
import { STYLE_QUIZ_QUESTIONS, STYLE_QUIZ_RESULTS } from '../data/quiz-data';

@Injectable({ providedIn: 'root' })
export class QuizService {
  readonly questions: QuizQuestion[] = STYLE_QUIZ_QUESTIONS;

  computeResult(answers: Record<number, DecorStyleTag>): StyleResult {
    const tally: Record<DecorStyleTag, number> = {
      minimalist: 0,
      scandinavian: 0,
      industrial: 0,
      bohemian: 0,
    };

    for (const tag of Object.values(answers)) {
      tally[tag]++;
    }

    const winningTag = (Object.keys(tally) as DecorStyleTag[]).reduce((best, tag) =>
      tally[tag] > tally[best] ? tag : best
    );

    return STYLE_QUIZ_RESULTS.find(r => r.tag === winningTag) || STYLE_QUIZ_RESULTS[0];
  }
}
