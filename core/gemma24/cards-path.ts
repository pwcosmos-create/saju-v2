import fs from 'fs';
import path from 'path';

/** saju-v2가 읽는 cards.json 후보 (앞에서부터 존재하는 첫 파일 사용) */
export function liveCardsPaths(): string[] {
  const fromEnv = process.env.GEMMA24_SAJU_CARDS_PATH?.trim();
  return [
    fromEnv,
    '/home/ubuntu/coupax-homepage/board/data/saju_learning/cards.json',
    path.join(process.cwd(), 'core/data/cards.live.json'),
  ].filter(Boolean) as string[];
}

/** 디스크에 있는 첫 cards.json (없으면 sync 대상 경로) */
export function resolveExistingLiveCardsPath(): string {
  for (const p of liveCardsPaths()) {
    if (fs.existsSync(p)) return p;
  }
  return path.join(process.cwd(), 'core/data/cards.live.json');
}
