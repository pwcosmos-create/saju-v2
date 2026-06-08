import fs from 'fs';
import path from 'path';

/** Oracle 운영 서버 live cards.json (단일 원본) */
export const SERVER_CARDS_JSON_PATH =
  '/home/ubuntu/coupax-homepage/board/data/saju_learning/cards.json';

/**
 * GEMMA24_SAJU_CARDS_PATH → 번들 cards.live.json → 서버 live 파일 순
 */
export function liveCardsPaths(): string[] {
  const fromEnv = process.env.GEMMA24_SAJU_CARDS_PATH?.trim();
  const paths: string[] = [];
  if (fromEnv) paths.push(fromEnv);
  if (!paths.some((p) => pathNormalize(p) === pathNormalize(SERVER_CARDS_JSON_PATH))) {
    paths.push(SERVER_CARDS_JSON_PATH);
  }
  const bundled = path.join(process.cwd(), 'core', 'data', 'cards.live.json');
  if (!paths.some((p) => pathNormalize(p) === pathNormalize(bundled))) {
    paths.push(bundled);
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
