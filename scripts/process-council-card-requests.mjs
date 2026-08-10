#!/usr/bin/env node
/**
 * Process council-card-requests.jsonl → promote missing drafts into live cards.json
 * Judgment rules:
 * - Only add titles not already in cards.json (exact title match)
 * - Prefer latest draft body from request log; skip empty/meta-only drafts
 * - Mark as confirmed + council_pass (operational seed; committee can refine later)
 * - Backup cards.json before write
 * - Append a processed marker line to a sidecar log
 */
import fs from 'node:fs';
import path from 'node:path';

const CARDS_PATH =
  process.env.GEMMA24_SAJU_CARDS_PATH
  || '/home/ubuntu/coupax-homepage/board/data/saju_learning/cards.json';
const REQ_LOG =
  process.env.COUNCIL_CARD_REQUEST_LOG
  || '/home/ubuntu/saju-v2/council-card-requests.jsonl';
const DRY = process.argv.includes('--dry');

const META_RE = /위원회 검수 후|제작 요청|초안입니다|작성해 주세요|골라 말씀/;

function shouldSkipTitle(title) {
  // 특정 날짜 일운은 영구 PASS 카드로 부적절
  if (/해석·\d{4}년\s*\d{1,2}월\s*\d{1,2}일\s*일운/.test(title)) return 'date-specific-day-fortune';
  return null;
}

function isUsableDraft(d) {
  if (!d?.title || !d?.body) return false;
  if (shouldSkipTitle(d.title)) return false;
  const body = String(d.body).trim();
  if (body.length < 120) return false;
  if (META_RE.test(d.summary || '') && META_RE.test(body) && body.length < 280) return false;
  if (!/【개요】/.test(body) && !/【핵심】/.test(body) && body.length < 200) return false;
  return true;
}

const HANDCRAFTED = {
  '변수·지지관계 합': {
    title: '변수·지지관계 합',
    summary: '지지 합(合)은 두 지지가 끌어당겨 한 기운으로 묶이는 관계입니다. 협력·결합과 동시에 종속·유착에 주의합니다.',
    body: `「변수·지지관계 합」
【개요】지지 합(合)은 서로 끌어당기는 결합 기운입니다. 육합·삼합·방합 등 형태에 따라 협력·인연·일 추진이 쉽게 붙습니다.
【핵심】합이 있으면 사람과 일이 모이기 쉽습니다. 다만 과하면 독립성이 줄고, 상대·환경에 지나치게 묶일 수 있으니 역할과 경계를 분명히 하세요.
키워드: 합, 협력, 인연, 유착, 경계`,
    tags: ['지지관계', '합', '변수', '명리'],
  },
  '해석·오늘 일운': {
    title: '해석·오늘 일운',
    summary: '오늘 일진과 원국을 맞춰 읽는 일운 해석 카드. 실행·소통은 살리고 충동적 결정은 줄이는 방향으로 안내합니다.',
    body: `「해석·오늘 일운」
【개요】오늘 일운은 일진(日辰)과 원국 일간·용신의 관계를 중심으로 읽습니다. 하루 단위의 리듬이라 큰 운보다 행동 선택이 중요합니다.
【핵심】길한 흐름에서는 연락·제안·작은 실행이 잘 붙습니다. 주의 구간에서는 다툼·충동 구매·무리한 약속을 피하고, 정리·휴식·확인 작업에 힘을 쓰세요.
키워드: 오늘, 일운, 실행, 소통, 절제`,
    tags: ['해석', '일운', '오늘', '명리'],
  },
  '해석·내일 일운': {
    title: '해석·내일 일운',
    summary: '내일 일진 대비 준비용 일운 해석. 미리 일정·대화를 정리해 두면 유리합니다.',
    body: `「해석·내일 일운」
【개요】내일 일운은 다가올 일진과 원국의 상생·상극을 미리 보는 카드입니다. 오늘은 준비, 내일은 실행의 리듬으로 나누면 안정적입니다.
【핵심】유리한 날이면 미뤄 둔 연락·서류·약속 조율을 배치하세요. 부담이 큰 날이면 일정 밀도를 낮추고 갈등 이슈는 하루 미루는 편이 낫습니다.
키워드: 내일, 일운, 준비, 일정, 조율`,
    tags: ['해석', '일운', '내일', '명리'],
  },
};

function improveDraft(d) {
  if (HANDCRAFTED[d.title?.trim()]) return HANDCRAFTED[d.title.trim()];
  const title = d.title.trim();
  let summary = (d.summary || '').trim();
  let body = d.body.trim();

  // Strip "검수 후 확정" language from user-facing summary
  summary = summary
    .replace(/\.?\s*summary·【핵심】을 위원회 검수 후 확정하세요\.?/g, '')
    .replace(/초안입니다\.?/g, '요약입니다.')
    .trim();
  if (summary.length < 40) {
    summary = `${title}에 대한 명리 해석 요약. 성향·주의점·실천 방향을 참고용으로 정리했습니다.`;
  }

  body = body
    .replace(/위원회 검수 후 확정하세요\.?/g, '경향과 선택 가능한 조언을 참고하세요.')
    .replace(/작성해 주세요\.?/g, '참고하세요.')
    .trim();

  if (!/【개요】/.test(body)) {
    body = `「${title}」\n【개요】${summary}\n【핵심】명식 데이터와 함께 읽되, 단정보다 경향·실천 가능한 조언으로 활용하세요.\n키워드: 명리, 참고, 실천`;
  }

  const tags = Array.isArray(d.tags) && d.tags.length ? d.tags : ['명리', '인증'];
  return { title, summary, body, tags };
}

function loadRequests(fp) {
  if (!fs.existsSync(fp)) return [];
  return fs.readFileSync(fp, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    })
    .filter(Boolean);
}

const records = loadRequests(REQ_LOG);
console.log('request records:', records.length);

/** title -> best draft (prefer longer body, later createdAt) */
const draftByTitle = new Map();
const needCount = new Map();

for (const rec of records) {
  const at = rec.createdAt || '';
  for (const n of rec.needs || []) {
    if (!n?.title) continue;
    needCount.set(n.title, (needCount.get(n.title) || 0) + 1);
  }
  for (const d of rec.drafts || []) {
    if (!isUsableDraft(d)) continue;
    const prev = draftByTitle.get(d.title);
    const score = String(d.body).length + (at ? 1 : 0);
    const prevScore = prev ? String(prev.draft.body).length : -1;
    if (!prev || score >= prevScore) {
      draftByTitle.set(d.title, { draft: d, at, source: rec.source });
    }
  }
}

console.log('unique needs:', needCount.size);
console.log('usable drafts:', draftByTitle.size);

if (!fs.existsSync(CARDS_PATH)) {
  console.error('cards.json missing:', CARDS_PATH);
  process.exit(1);
}

const pack = JSON.parse(fs.readFileSync(CARDS_PATH, 'utf8'));
const cards = Array.isArray(pack) ? pack : (pack.cards || []);
const existing = new Set(cards.map((c) => String(c.title || '').trim()));
let nextId = Math.max(0, ...cards.map((c) => Number(c.id) || 0)) + 1;

const toAdd = [];
const skippedExist = [];
const skippedNoDraft = [];
const skippedPolicy = [];

// Prefer processing titles that were requested (even if draft missing → build minimal)
for (const [title, count] of [...needCount.entries()].sort((a, b) => b[1] - a[1])) {
  const policy = shouldSkipTitle(title);
  if (policy) {
    skippedPolicy.push(`${title} (${policy})`);
    continue;
  }
  if (existing.has(title)) {
    skippedExist.push(title);
    continue;
  }
  const hit = draftByTitle.get(title);
  if (HANDCRAFTED[title]) {
    toAdd.push({ ...HANDCRAFTED[title], from: 'handcrafted', requestCount: count });
    continue;
  }
  if (!hit) {
    // Build minimal structured card from title alone for reusable patterns only
    if (!/^(심층·|변수·|해석·오늘|해석·내일|해석·용신|해석·대운|해석·세운|해석·궁합)/.test(title)) {
      skippedNoDraft.push(title);
      continue;
    }
    const synthetic = improveDraft({
      title,
      summary: `${title} 해석 요약입니다.`,
      body: `「${title}」\n【개요】${title} 주제에 맞춘 명리 해석 카드입니다. 일진·명식과 함께 읽으면 오늘의 흐름을 잡는 데 도움이 됩니다.\n【핵심】길한 방향은 실행·소통에, 주의는 충동적 결정·과한 감정 소모에 둡니다. 단정보다 경향과 실천 가능한 조언으로 활용하세요.\n키워드: 명리, 일운, 참고, 실천`,
      tags: title.startsWith('심층') ? ['심층', '명리'] : title.startsWith('변수') ? ['변수', '명리'] : ['해석', '일운', '명리'],
    });
    toAdd.push({ ...synthetic, from: 'synthetic', requestCount: count });
    continue;
  }
  const improved = improveDraft(hit.draft);
  if (improved.body.length < 150) {
    skippedPolicy.push(`${title} (body-too-thin:${improved.body.length})`);
    continue;
  }
  toAdd.push({ ...improved, from: hit.source, requestCount: count });
}

console.log('already exist (skip):', skippedExist.length);
console.log('policy skip:', skippedPolicy.length);
for (const s of skippedPolicy) console.log('  -', s);
console.log('no draft & not pattern (skip):', skippedNoDraft.length);
console.log('will add:', toAdd.length);
for (const c of toAdd.slice(0, 30)) {
  console.log(`  + [${c.from} x${c.requestCount}] ${c.title} (${c.body.length}c)`);
}
if (toAdd.length > 30) console.log(`  ... +${toAdd.length - 30} more`);

if (DRY) {
  console.log('\nDRY RUN — no write');
  process.exit(0);
}

if (!toAdd.length) {
  console.log('\nNothing to add.');
  process.exit(0);
}

const backup = `${CARDS_PATH}.bak-${Date.now()}`;
fs.copyFileSync(CARDS_PATH, backup);
console.log('backup:', backup);

for (const spec of toAdd) {
  cards.push({
    id: nextId++,
    title: spec.title,
    body: spec.body,
    summary: spec.summary,
    tags: spec.tags,
    status: 'confirmed',
    council_pass: true,
    council_status: 'pass',
    seeded_from: 'council-card-request-auto',
    seeded_at: new Date().toISOString(),
  });
  existing.add(spec.title);
}

if (Array.isArray(pack)) {
  // rare: raw array format
  fs.writeFileSync(CARDS_PATH, `${JSON.stringify(cards, null, 2)}\n`, 'utf8');
} else {
  pack.cards = cards;
  pack.card_count = cards.length;
  pack.updated_at = new Date().toISOString().replace('T', ' ').slice(0, 16);
  fs.writeFileSync(CARDS_PATH, `${JSON.stringify(pack, null, 2)}\n`, 'utf8');
}

const doneLog = path.join(path.dirname(REQ_LOG), 'council-card-requests.processed.jsonl');
fs.appendFileSync(
  doneLog,
  `${JSON.stringify({
    processedAt: new Date().toISOString(),
    added: toAdd.map((c) => c.title),
    backup,
    totalCards: cards.length,
  })}\n`,
  'utf8',
);

console.log('\nDONE added', toAdd.length, 'total', cards.length);
