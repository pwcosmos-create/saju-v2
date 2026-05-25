/**
 * TTS용 텍스트 정리 — 상담 답변 추출 + 한자·기호·메타 제거 + 날짜 읽기 변환
 */
import { extractCounselVoiceAnswer } from './counsel-voice-answer';
import { stripHanjaForTts } from './strip-hanja-for-tts';

/** ISO·범위 날짜를 음성에 맞게 */
export function normalizeDatesForTts(text: string): string {
  return text
    .replace(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g, (_, y, m, d) => {
      return `${y}년 ${Number.parseInt(m, 10)}월 ${Number.parseInt(d, 10)}일`;
    })
    .replace(/(\d{4})~(\d{4})/g, (_, a, b) => `${a}년부터 ${b}년까지`)
    .replace(/(\d+)세\(/g, '$1세, ');
}

/** 점수·키워드·파이프 등 읽기 노이즈 */
export function stripTtsNoise(text: string): string {
  return text
    .replace(/【[^】]*】/g, '')
    .replace(/★+/g, '')
    .replace(/\s*\|\s*/g, '. ')
    .replace(/점수\s*[-\d.]+\s*/g, '')
    .replace(/(?:^|\n)\s*키워드\s*[:：][^\n]*/gim, '')
    .replace(/(?:^|\n)\s*—\s*saju\.coupax\.co\.kr\s*$/gim, '')
    .replace(/\[(\d+)\]\s*\d+\.\s*[^\n]+/g, '')
    .replace(/^—\s+/gm, '')
    .replace(/\s*·\s*/g, ', ')
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export type PrepareTtsOptions = {
  /** 상담 답변: 인트로·푸터·면책 제거 (기본 true) */
  counselAnswer?: boolean;
};

/** Web Speech / Gemini TTS 공통 입력 */
export function prepareTextForTts(text: string, opts: PrepareTtsOptions = {}): string {
  const counselAnswer = opts.counselAnswer !== false;
  let t = text.trim();
  if (!t) return '';
  if (counselAnswer) t = extractCounselVoiceAnswer(t);
  t = stripTtsNoise(t);
  t = normalizeDatesForTts(t);
  t = stripHanjaForTts(t);
  return t.trim();
}
