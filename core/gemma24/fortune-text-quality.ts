/**
 * 심층 풀이 화면용 본문 품질 — 미채움 변수·제작 메타·빈 ◆ 블록
 */

const AUTHOR_META_RE =
  /일간·월지·격국|월지\s*본기\s*정기|본기로\s*격을\s*잡|으로만\s*서술|따뜻하되\s*과장하지|격\s*vs\s*용신|학파·신강신약에\s*따라\s*달라질\s*수\s*있음|두\s*지지가\s*사주·운에서\s*성립할\s*때만|판정\s*근거|위원회\s*검증/i;

const BROKEN_PLACEHOLDER_RE = [
  /에\s*해당하는\s*기운/,
  /지지\s*관계은?\(는\)?/,
  /운은?\(는\)?\s*일간/,
  /격국은?\(는\)?\s*일간/,
  /(?:^|[\s,.])로\s*(?:강점|완화|과잉)/,
  /(?:^|[\s,.])으(?:로만|로\s*강)/,
  /(?:^|[\s,.])와\s*맞물릴/,
  /의\s*색깔에\s*가깝습니다/,
  /를\s*보는\s*자리라고/,
  /쉽게\s*말하면\s*의\s+/,
];

const GENERIC_INTRO_RE = /오늘은\s*귀하의\s*사주에서/;

const UNKNOWN_HOUR_RE = /시주\s*\(?時柱\)?\s*를\s*모르|시주를\s*모르/i;

export function promptHasHourPillar(query: string): boolean {
  const q = query.trim();
  if (!q) return false;
  if (/시주\s*[:：]\s*미입력/.test(q)) return false;
  if (/시주\s*[:：]\s*[^\s/|·]+/.test(q) && !/시주\s*[:：]\s*미입력/.test(q)) return true;
  if (/시주\s+[^\s/|·]{2,}/.test(q) && !/시주\s+미입력/.test(q)) return true;
  return false;
}

export function isAuthoringMetaText(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (AUTHOR_META_RE.test(t)) return true;
  if (/월지\s*본기/.test(t) && t.length < 100) return true;
  return false;
}

export function isBrokenPlaceholderText(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (t.length <= 2 && /^[으로와과]$/.test(t)) return true;
  return BROKEN_PLACEHOLDER_RE.some((re) => re.test(t));
}

export function isBrokenDisplayLine(line: string): boolean {
  const t = line.replace(/^◆\s*/, '').replace(/^—\s*/, '').trim();
  if (!t) return true;
  if (isBrokenPlaceholderText(t)) return true;
  if (isAuthoringMetaText(t)) return true;
  return false;
}

/** ◆ 블록·문단 정리 후 화면용 본문 */
export function pruneFortuneSectionBody(
  body: string,
  opts?: { hasHourPillar?: boolean; skipIntroDedupe?: boolean },
): string {
  let text = body.replace(/\r\n/g, '\n').trim();
  if (!text) return '';

  if (opts?.hasHourPillar) {
    text = text
      .split('\n')
      .filter((line) => !UNKNOWN_HOUR_RE.test(line))
      .join('\n');
  }

  let sawIntro = Boolean(opts?.skipIntroDedupe);
  const blocks = text.split(/\n\n+/);
  const keptBlocks: string[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('◆')) {
      const lines = trimmed.split('\n');
      const header = lines[0]?.trim() ?? '';
      const rest = lines.slice(1).map((l) => l.trim()).filter(Boolean);
      const goodLines = rest.filter((l) => !isBrokenDisplayLine(l));
      if (!goodLines.length) continue;
      if (GENERIC_INTRO_RE.test(goodLines.join(' ')) && sawIntro) continue;
      if (GENERIC_INTRO_RE.test(goodLines.join(' '))) sawIntro = true;
      keptBlocks.push([header, ...goodLines].join('\n'));
      continue;
    }

    const lines = trimmed.split('\n').filter((l) => l.trim());
    const goodLines = lines.filter((l) => !isBrokenDisplayLine(l));
    if (!goodLines.length) continue;
    const joined = goodLines.join('\n');
    if (GENERIC_INTRO_RE.test(joined) && sawIntro) continue;
    if (GENERIC_INTRO_RE.test(joined)) sawIntro = true;
    keptBlocks.push(joined);
  }

  return keptBlocks.join('\n\n').trim();
}

/** 보충 LLM 필요 여부 (정리 후에도 짧거나 깨짐 잔존) */
export function isLowQualityFortuneBody(body: string): boolean {
  const t = body.trim();
  if (t.length < 80) return true;
  if (isBrokenPlaceholderText(t)) return true;
  if (AUTHOR_META_RE.test(t) && t.length < 200) return true;

  const lines = t.split('\n').map((l) => l.replace(/^◆\s*|^—\s*/, '').trim()).filter(Boolean);
  const substantive = lines.filter(
    (l) => l.length >= 20 && !isAuthoringMetaText(l) && !isBrokenPlaceholderText(l),
  );
  if (substantive.length < 2) return true;

  const brokenLines = lines.filter((l) => isBrokenDisplayLine(l));
  if (brokenLines.length >= 2) return true;

  return false;
}

/** needsSupplement 대상 섹션 본문 제거 (보충으로 교체) */
export function removeFortuneSectionBlocks(text: string, sectionIds: string[]): string {
  if (!sectionIds.length) return text;
  const remove = new Set(sectionIds);
  const parts = text.split(/(?=^\[\d+\])/m).map((p) => p.trim()).filter(Boolean);
  const header = parts[0]?.startsWith('[') ? '' : parts.shift();
  const kept = parts.filter((block) => {
    const id = block.match(/^\[(\d+)\]/)?.[1];
    return !id || !remove.has(id);
  });
  return [header, ...kept].filter(Boolean).join('\n\n').trim();
}
