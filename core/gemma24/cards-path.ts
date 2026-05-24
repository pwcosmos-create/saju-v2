import fs from 'fs';

/** Oracle 운영 서버 live cards.json (단일 원본) */
export const SERVER_CARDS_JSON_PATH =
  '/home/ubuntu/coupax-homepage/board/data/saju_learning/cards.json';

/**
 * saju-v2가 읽는 cards.json — 서버 live 파일만 (로컬 cards.live.json·pack 폴백 제외)
 * GEMMA24_SAJU_CARDS_PATH가 있으면 그 경로를 우선, 없으면 SERVER_CARDS_JSON_PATH
 */
export function liveCardsPaths(): string[] {
  const fromEnv = process.env.GEMMA24_SAJU_CARDS_PATH?.trim();
  const paths: string[] = [];
  if (fromEnv) paths.push(fromEnv);
  if (!fromEnv || pathNormalize(fromEnv) !== pathNormalize(SERVER_CARDS_JSON_PATH)) {
    paths.push(SERVER_CARDS_JSON_PATH);
  }
  return paths;
}

function pathNormalize(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+$/, '');
}

/** 존재하는 서버 cards.json 경로 (없으면 null) */
export function resolveExistingLiveCardsPath(): string | null {
  for (const p of liveCardsPaths()) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}
