/**
 * 심층 풀이 화면용 본문 품질 — 미채움 변수·제작 메타·빈 ◆ 블록
 */
import { lacksChartPersonalization } from './council-fortune-enrich';

const AUTHOR_META_RE =
  /일간·월지·격국|월지\s*본기\s*정기|본기로\s*격을\s*잡|으로만\s*서술|따뜻하되\s*과장하지|격\s*vs\s*용신|학파·신강신약에\s*따라\s*달라질\s*수\s*있음|두\s*지지가\s*사주·운에서\s*성립할\s*때만|판정\s*근거|위원회\s*검증/i;

const BROKEN_PLACEHOLDER_RE = [
  /에\s*해당하는\s*기운/,
  /지지\s*관계은?\(는\)?/,
  /운은?\(는\)?\s*일간/,
  /격국은?\(는\)?\s*일간/,
  /(?:^|[\s,.])로\s*(?:강점|완화|과잉)/,
  /(?:^|[\s,.])으(?:로만|로\s*강|을\s*분명히)/,
  /(?:^|[\s,.])와\s*맞물릴/,
  /(?:^|[\s,.])을\s*분명히/,
  /(?:^|[\s,.])처럼\s*가능성/,
  /의\s*색깔에\s*가깝습니다/,
  /를\s*보는\s*자리라고/,
  /쉽게\s*말하면\s*의\s+/,
  /^이\s*강할\s*때는/,
  /^이\s*약할\s*때는/,
  /사주팔자에서\s*이\s*년/,
  /[가-힣]{2,}[（(]\s*[）)]/,
  /[（(]\s*[）)]/,
];

const ANNOTATION_LINE_RE = /←|이 일간에게|용신·희신과 겹치면|표시번호|본문id/;

const GENERIC_ONLY_SUBHEAD_RE = /^◆\s*(명식·구조|실천\s*조언|주의|주의·마무리|인사·성향)$/;
const GENERIC_OHAENG_RE = /월지\s*\(?月支\)?\s*는\s*계절의\s*기운/;
const ENCYCLOPEDIC_JOB_RE =
  /관성이 강하면 조직·공무·규율·책임, 식상이면 기술·교육·창업·콘텐츠/;

const GENERIC_INTRO_RE = /오늘은\s*귀하의\s*사주에서/;

const CARD_SCAFFOLD_RE =
  /【[^】]+】|◆\s*테마\s*풀이|골라\s*말씀드립니다|일간\s*=\s*겉\s*성향|◆\s*해석·/;

const UNKNOWN_HOUR_RE = /시주\s*\(?時柱\)?\s*를\s*모르|시주를\s*모르/i;

/** 인증 카드 제작 초안·메타 블록이 그대로 노출된 본문 */
export function isCardScaffoldBody(body: string): boolean {
  const t = body.trim();
  if (!t) return false;
  if (CARD_SCAFFOLD_RE.test(t)) return true;
  if (GENERIC_INTRO_RE.test(t)) return true;
  const heads = t.match(/^◆\s*.+$/gm) ?? [];
  if (heads.length >= 3) return true;
  if (/…\s*(\n|$)/.test(t) && t.length < 900) return true;
  return false;
}

function lineHasUnclosedParen(line: string): boolean {
  let depth = 0;
  for (const ch of line) {
    if (ch === '(' || ch === '（') depth += 1;
    if (ch === ')' || ch === '）') depth -= 1;
  }
  return depth > 0;
}

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
  if (ANNOTATION_LINE_RE.test(t)) return true;
  if (/월지\s*본기/.test(t) && t.length < 100) return true;
  return false;
}

export function isBrokenPlaceholderText(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (t.length <= 2 && /^[으로와과]$/.test(t)) return true;
  if (lineHasUnclosedParen(t)) return true;
  return BROKEN_PLACEHOLDER_RE.some((re) => re.test(t));
}

export function isBrokenDisplayLine(line: string): boolean {
  const t = line.replace(/^◆\s*/, '').replace(/^—\s*/, '').trim();
  if (!t) return true;
  if (isBrokenPlaceholderText(t)) return true;
  if (isAuthoringMetaText(t)) return true;
  if (lineHasUnclosedParen(t)) return true;
  if (/【[^】]+】/.test(t)) return true;
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
      if (/◆\s*(테마\s*풀이|해석·)/.test(header) || /【/.test(header)) continue;
      const rest = lines.slice(1).map((l) => l.trim()).filter(Boolean);
      const goodLines = rest
        .map((l) => normalizeFortuneLine(l))
        .filter((l) => l.trim() && !isBrokenDisplayLine(l));
      if (!goodLines.length) continue;
      if (GENERIC_INTRO_RE.test(goodLines.join(' ')) && sawIntro) continue;
      if (GENERIC_INTRO_RE.test(goodLines.join(' '))) sawIntro = true;
      keptBlocks.push([header, ...goodLines].join('\n'));
      continue;
    }

    const lines = trimmed.split('\n').filter((l) => l.trim());
    const goodLines = lines
      .map((l) => normalizeFortuneLine(l))
      .filter((l) => l.trim() && !isBrokenDisplayLine(l));
    if (!goodLines.length) continue;
    const joined = goodLines.join('\n');
    if (GENERIC_INTRO_RE.test(joined) && sawIntro) continue;
    if (GENERIC_INTRO_RE.test(joined)) sawIntro = true;
    keptBlocks.push(joined);
  }

  return keptBlocks.join('\n\n').trim();
}

/** 명식 키워드 없이 프레임(주의·실천·명식)만 있는 절 */
export function isGenericTemplateOnlyBody(body: string): boolean {
  const headers = body.match(/^◆\s*.+$/gm) ?? [];
  if (headers.length < 2) return false;
  if (!headers.every((h) => GENERIC_ONLY_SUBHEAD_RE.test(h.trim()))) return false;
  if (GENERIC_OHAENG_RE.test(body) && !/목\s*\d+\s*개|지배 오행|넘치는 기운/.test(body)) return true;
  return /년주는\s*유년|월주는\s*사회/.test(body)
    && !/일간|용신|기신|[갑을병정무기경신임계][인묘진사오미신유술亥]{1,2}/.test(body);
}

export function sectionBlockHasBrokenFragments(block: string): boolean {
  return block.split('\n').some((line) => {
    const t = line.trim();
    if (!t || t.startsWith('[')) return false;
    return isBrokenDisplayLine(line);
  });
}

/** 보충 LLM 필요 여부 (정리 후에도 짧거나 깨짐 잔존) */
export function isLowQualityFortuneBody(body: string, query?: string): boolean {
  const t = body.trim();
  if (t.length < 80) return true;
  if (isBrokenPlaceholderText(t)) return true;
  if (AUTHOR_META_RE.test(t) && t.length < 200) return true;

  const lines = t.split('\n').map((l) => l.replace(/^◆\s*|^—\s*/, '').trim()).filter(Boolean);
  const substantive = lines.filter(
    (l) => l.length >= 20 && !isAuthoringMetaText(l) && !isBrokenPlaceholderText(l),
  );
  if (substantive.length < 2) return true;
  if (isGenericTemplateOnlyBody(t)) return true;
  if (isCardScaffoldBody(t)) return true;
  if (query && lacksChartPersonalization(t, query)) return true;
  if (ENCYCLOPEDIC_JOB_RE.test(t)) return true;
  if (GENERIC_OHAENG_RE.test(t) && !/목\s*\d+\s*개|지배 오행|넘치는 기운/.test(t)) return true;

  const brokenLines = lines.filter((l) => isBrokenDisplayLine(l));
  if (brokenLines.length >= 1) return true;

  return false;
}

/** LLM이 섞은 중국어 단어·깨진 패턴 */
export function fortuneOutputHasDefects(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (BROKEN_PLACEHOLDER_RE.some((re) => re.test(t))) return true;
  if (/[\u4e00-\u9fff]{3,}/.test(t.replace(/[（）()]/g, ''))) return true;
  if (/表現|活動|正官|偏印|本元|劫財/.test(t)) return true;
  if (/←/.test(t)) return true;
  if (/[가-힣]{2,}\(\s*\)/.test(t)) return true;
  if (t.split('\n').some((line) => lineHasUnclosedParen(line.trim()))) return true;
  if (isCardScaffoldBody(t)) return true;
  return false;
}

const FOOTER_RE = /\n*—\n*참고용\s*풀이[^\n]*(?=\n|$)/gi;
const EMPTY_PARENS_AFTER_KO_RE = /([가-힣]{2,})[（(]\s*[）)]/g;
const ANNOTATION_SUFFIX_RE = /\s*←[^\n]*/g;
const DUPLICATE_DISCLAIMER_RE =
  /◆\s*주의[^\n]*\n[\s\S]*?명리학적\s*경향[\s\S]*?(?=\n\n◆\s*주의|\n\n—|$)/g;

/** 한 줄 — 카드 주석(←)·빈 괄호 제거 */
export function normalizeFortuneLine(line: string): string {
  return line
    .replace(ANNOTATION_SUFFIX_RE, '')
    .replace(EMPTY_PARENS_AFTER_KO_RE, '$1')
    .replace(/\s{2,}/g, ' ')
    .trimEnd();
}

/** 본문 전역 정리 (면책 중복·빈 격국 괄호·←) */
export function polishFortuneText(text: string): string {
  let out = stripFortuneFooters(text);
  out = out
    .split('\n')
    .map((line) => (line.trimStart().startsWith('[') ? line : normalizeFortuneLine(line)))
    .join('\n');
  out = out.replace(EMPTY_PARENS_AFTER_KO_RE, '$1');
  const seen = new Set<string>();
  out = out.replace(DUPLICATE_DISCLAIMER_RE, (block) => {
    const key = block.slice(0, 80);
    if (seen.has(key)) return '';
    seen.add(key);
    return block;
  });
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

/** 중복 면책·푸터 제거 */
export function stripFortuneFooters(text: string): string {
  return text.replace(FOOTER_RE, '').replace(/\n{3,}/g, '\n\n').trim();
}

/** 본문에서 3자 이상 연속 한자(괄호 밖) 제거 */
export function sanitizeMixedScript(text: string): string {
  return text
    .replace(/([^（(]*?)[\u4e00-\u9fff]{3,}([^）)]*?)/g, (full, before, after) => {
      if (/용신|기신|십신|대운|세운|편재|정재|비견|식신|\([^\)]{0,8}\)/.test(full)) return full;
      return `${before}${after}`;
    })
    .replace(/表現力|活動/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function extractSectionBody(block: string): string {
  return block.replace(/^\[\d+\][^\n]*\n?/, '').trim();
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
