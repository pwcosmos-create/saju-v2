import { prepareTextForTts, type PrepareTtsOptions } from './prepare-text-for-tts';
import { splitForPausedReading, type PausedReadUnit } from './tts-paused-reading';

/** Gemini 합성음 재생 속도 — 약간 느리게 하면 사람 말투에 가깝게 들림 */
export const SERVER_TTS_PLAYBACK_RATE = 0.97;

export const SERVER_TTS_API_CHAR_LIMIT = 520;

function sliceByWordBoundaryForTts(text: string, max: number): string[] {
  const out: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    let cut = rest.lastIndexOf(' ', max);
    if (cut < Math.floor(max * 0.45)) cut = max;
    const piece = rest.slice(0, cut).trim();
    if (piece) out.push(piece);
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out.filter(Boolean);
}

/** 한 utterance가 API 상한을 넘을 때만 쉼표·공백 기준으로 분할 */
export function splitUnitForApi(text: string): string[] {
  const max = SERVER_TTS_API_CHAR_LIMIT;
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= max) return [trimmed];

  const clauses = trimmed.split(/(?<=[,，])\s*/).map((c) => c.trim()).filter(Boolean);
  if (clauses.length > 1) {
    const out: string[] = [];
    let cur = '';
    for (const c of clauses) {
      const joined = cur ? `${cur} ${c}` : c;
      if (joined.length <= max) {
        cur = joined;
        continue;
      }
      if (cur) out.push(cur);
      if (c.length <= max) {
        cur = c;
        continue;
      }
      out.push(...sliceByWordBoundaryForTts(c, max));
      cur = '';
    }
    if (cur) out.push(cur);
    return out.length ? out : sliceByWordBoundaryForTts(trimmed, max);
  }
  return sliceByWordBoundaryForTts(trimmed, max);
}

export function buildNaturalTtsUnits(
  text: string,
  opts: PrepareTtsOptions = {},
): PausedReadUnit[] {
  const prepared = prepareTextForTts(text, opts);
  if (!prepared) return [];
  return splitForPausedReading(prepared);
}
