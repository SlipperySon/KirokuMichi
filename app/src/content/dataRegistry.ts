// Centralized registry of data file locations for easy swapping
// To replace data: update file paths below and replace files in app/data/generated/jlpt/

export const VOCAB_FILES: Record<string, string> = {
  N5: '../../data/generated/jlpt/vocab-N5.json',
  N4: '../../data/generated/jlpt/vocab-N4.json',
  N3: '../../data/generated/jlpt/vocab-N3.json',
  N2: '../../data/generated/jlpt/vocab-N2.json',
  N1: '../../data/generated/jlpt/vocab-N1.json',
}

export const GRAMMAR_FILES: Record<string, string> = {
  N5: '../../data/generated/jlpt/grammar-n5.json',
  N4: '../../data/generated/jlpt/grammar-n4.json',
  N3: '../../data/generated/jlpt/grammar-n3.json',
  N2: '../../data/generated/jlpt/grammar-n2.json',
  N1: '../../data/generated/jlpt/grammar-n1.json',
}

export const QUIZ_FILES: string[] = [
  '../../data/generated/jlpt/quiz-part1.json',
  '../../data/generated/jlpt/quiz-part2.json',
  '../../data/generated/jlpt/quiz-part3.json',
  '../../data/generated/jlpt/quiz-part4.json',
  '../../data/generated/jlpt/quiz-part5.json',
  '../../data/generated/jlpt/quiz-part6.json',
  '../../data/generated/jlpt/quiz-part7.json',
  '../../data/generated/jlpt/quiz-part8.json',
  '../../data/generated/jlpt/quiz-part9.json',
  '../../data/generated/jlpt/quiz-part10.json',
]
