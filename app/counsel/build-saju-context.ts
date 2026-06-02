/**
 * buildChatContext — SajuResult → AI 상담용 요약 문자열
 * (app/chat-widget.tsx에서 분리)
 */
import type { SajuResult } from '../../core/pillar-calc/main-calculator';
import {
  STEMS, BRANCHES, STEMS_H, BRANCHES_H,
  STEM_ELEM, BRANCH_ELEM, ELEM_NAMES,
} from '../../core/pillar-calc/korean-calendar-engine';
import { classifyElements } from '../../core/daily-fortune/classifier';

const GENERATES = [1, 2, 3, 4, 0];

export function buildChatContext(r: SajuResult): string {
  const [yp, mp, dp, hp] = r.pillars;
  const ds = dp?.s ?? 0;
  const de = STEM_ELEM[ds];
  const ps = (p: { s: number; b: number } | null) =>
    p ? `${STEMS[p.s]}${BRANCHES[p.b]}(${STEMS_H[p.s]}${BRANCHES_H[p.b]})` : '미입력';

  const weighted = [
    yp && { e: STEM_ELEM[yp.s], w: 1 }, yp && { e: BRANCH_ELEM[yp.b], w: 1 },
    mp && { e: STEM_ELEM[mp.s], w: 1 }, mp && { e: BRANCH_ELEM[mp.b], w: 3 },
    dp && { e: BRANCH_ELEM[dp.b], w: 2 },
    hp && { e: STEM_ELEM[hp.s], w: 1 }, hp && { e: BRANCH_ELEM[hp.b], w: 1 },
  ].filter(Boolean) as { e: number; w: number }[];

  let sup = 0, drn = 0;
  for (const { e, w } of weighted) {
    if (e === de || GENERATES[e] === de) sup += w; else drn += w;
  }
  const isWeak = sup - drn <= 0;
  const cls = classifyElements(ds, isWeak, r.ohaeng.counts);
  const daeun = r.daeun.pillars.slice(0, 5)
    .map((p, i) => `${r.daeun.startAge + i * 10}세: ${STEMS[p.s]}${BRANCHES[p.b]}`).join(' / ');

  return `생년월일: ${r.input.year}년 ${r.input.month}월 ${r.input.day}일 (${r.input.gender}성)
사주: 연주 ${ps(yp)} | 월주 ${ps(mp)} | 일주 ${ps(dp)} | 시주 ${ps(hp)}
일간: ${ELEM_NAMES[de]}(${STEMS[ds]}) | ${isWeak ? '신약(身弱)' : '신강(身强)'}
오행: ${r.ohaeng.counts.map((c, i) => `${ELEM_NAMES[i]} ${c}개`).join(' · ')}
용신(用神): ${ELEM_NAMES[cls.yongsin]}
희신(喜神): ${cls.huisin.map(i => ELEM_NAMES[i]).join('·') || '없음'}
기신(忌神): ${cls.gisin.map(i => ELEM_NAMES[i]).join('·') || '없음'}
대운: ${daeun} (${r.daeun.forward ? '순행' : '역행'})`;
}
