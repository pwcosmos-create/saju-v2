'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import ChatWidget from './chat-widget';
import { calculate, SajuResult } from '../core/pillar-calc/main-calculator';
import {
  STEMS, BRANCHES, STEMS_H, BRANCHES_H, ZODIAC,
  STEM_ELEM, BRANCH_ELEM, ELEM_NAMES, ELEM_NAMES_H, ELEM_COLORS,
  getPillarIdx, Pillar,
} from '../core/pillar-calc/korean-calendar-engine';
import {
  IJ60_DESC, KEYWORDS_BY_STEM, SCORES_BY_STEM,
  JOBS_BY_STEM, F2026_BY_STEM, getIljooDesc,
} from '../core/interpretation-db/matcher';
import { buildPrompt } from '../core/ai-templates/blueprints';
import { fetchStream } from '../core/http-client/stream-fetcher';
import { dailyFortune } from '../core/daily-fortune';
import type { DailyFortuneResult } from '../core/daily-fortune';
import { calcStrength, getSipsin, classifyElements } from '../core/daily-fortune/classifier';
import { buildMonthlyBriefs } from '../core/daily-fortune/monthly-brief';
import type { MonthlyBrief } from '../core/daily-fortune/monthly-brief';
import type { OhaengResult } from '../core/pillar-calc/five-phase-breakdown';
import type { DaeunResult } from '../core/pillar-calc/grand-fortune';
import type { Shinsal } from '../core/pillar-calc/celestial-relations';

// 음력 변환 (클라이언트 전용)
type MsLib = { lunarToSolar: (y:number,m:number,d:number,leap:boolean)=>{year:number,month:number,day:number} };
let _ms: MsLib | null = null;
if (typeof window !== 'undefined') {
  import('manseryeok').then(mod => { _ms = mod as unknown as MsLib; }).catch(() => {});
}

const THIS_YEAR = new Date().getFullYear();
// 간지 연도: 갑자(甲子) = 1984 기준
function yearGanji(y: number): { s: number; b: number } {
  return { s: ((y - 4) % 10 + 10) % 10, b: ((y - 4) % 12 + 12) % 12 };
}
const ZODIAC_EMOJI = ['🐭','🐮','🐯','🐰','🐲','🐍','🐎','🐑','🐒','🐓','🐕','🐷'];

const SI_NAMES = ['자시(子時)','축시(丑時)','인시(寅時)','묘시(卯時)','진시(辰時)','사시(巳時)',
                  '오시(午時)','미시(未時)','신시(申時)','유시(酉時)','술시(戌時)','해시(亥時)'];
const fmt = (hh:number,mm:number) => `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
// 00:00~00:30 부터 23:30~00:00 까지 48슬롯, 자시 23:30~01:30 기준
const HOUR_OPTIONS: {v:number; label:string}[] = [{ v:-1, label:'모름 / 미입력' }];
for (let i = 0; i < 48; i++) {
  const totalMin = i * 30; // 0, 30, 60, ..., 1410(23:30)
  const h = Math.floor(totalMin / 60), m = totalMin % 60;
  const endMin = totalMin + 30, eh = Math.floor(endMin / 60) % 24, em = endMin % 60;
  const si = SI_NAMES[Math.floor((totalMin + 30) / 120) % 12];
  HOUR_OPTIONS.push({ v: totalMin, label: `${fmt(h,m)}~${fmt(eh,em)} — ${si}` });
}

const TAB_NAMES = ['성격','운세','신살','대운','월별','직업','건강'] as const;
type TabName = typeof TAB_NAMES[number];
const STEM_ICONS = ['🌳','🌿','☀️','🕯️','⛰️','🌾','🪨','💎','🌊','🌧️'];

// 오행 배지 색상 — 목:초록 화:빨강 토:황금 금:은회색 수:딥네이비(검정물)
const ELEM_BADGE = [
  { bg:'rgba(34,160,60,.20)',   border:'rgba(34,160,60,.50)',   text:'#5dce70' }, // 목
  { bg:'rgba(220,50,50,.20)',   border:'rgba(220,50,50,.50)',   text:'#ff7070' }, // 화
  { bg:'rgba(200,150,0,.20)',   border:'rgba(200,150,0,.50)',   text:'#e8c840' }, // 토
  { bg:'rgba(200,200,200,.12)', border:'rgba(200,200,200,.40)', text:'#e0e0e0' }, // 금
  { bg:'rgba(8,16,40,.88)',     border:'rgba(80,120,220,.50)',  text:'#90b8f0' }, // 수
] as const;

// ─── 스타일 헬퍼 ───
const inputStyle: React.CSSProperties = {
  background:'rgba(255,255,255,.06)', border:'1px solid var(--border)',
  borderRadius:10, padding:'11px 13px', color:'var(--text)',
  fontSize:'.92rem', width:'100%', outline:'none',
};
const selectStyle: React.CSSProperties = { ...inputStyle, appearance:'none', WebkitAppearance:'none' as 'none' };
const gBtnStyle: React.CSSProperties = {
  flex:1, padding:11, border:'1px solid var(--border)', borderRadius:10,
  background:'rgba(255,255,255,.05)', color:'var(--muted)', fontSize:'.88rem', fontWeight:700, cursor:'pointer',
};
const calBtnStyle: React.CSSProperties = {
  padding:'5px 14px', borderRadius:100, border:'1px solid var(--border)',
  background:'rgba(255,255,255,.05)', color:'var(--muted)', fontSize:'.78rem', fontWeight:700, cursor:'pointer',
};
const cardStyle: React.CSSProperties = {
  background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:22, marginBottom:16,
};

function Field({ label, children }: { label:string; children:React.ReactNode }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
      <label style={{ fontSize:'.75rem', fontWeight:700, color:'var(--muted)' }}>{label}</label>
      {children}
    </div>
  );
}

function ElemBadge({ idx }: { idx:number }) {
  const { bg, border, text } = ELEM_BADGE[idx];
  return (
    <span style={{ background:bg, border:`1px solid ${border}`, color:text,
      borderRadius:100, padding:'2px 9px', fontSize:'.72rem', fontWeight:700,
      display:'inline-block', whiteSpace:'nowrap' }}>
      {ELEM_NAMES[idx]}({ELEM_NAMES_H[idx]})
    </span>
  );
}

export default function Home() {
  const [year,   setYear]   = useState('');
  const [month,  setMonth]  = useState('');
  const [day,    setDay]    = useState('');
  const [hour,   setHour]   = useState('-1');
  const [name,   setName]   = useState('');
  const [gender, setGender] = useState<'남'|'여'>('남');
  const [lunar,  setLunar]  = useState(false);
  const [leapM,  setLeapM]  = useState(false);

  const [result,        setResult]        = useState<SajuResult | null>(null);
  const [fortuneResult, setFortuneResult] = useState<DailyFortuneResult | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [tab,      setTab]      = useState<TabName>('성격');
  const [aiText,   setAiText]   = useState('');
  const [aiLoading,setAiLoad]   = useState(false);
  const [showFb,   setShowFb]   = useState(false);
  const [fbDone,   setFbDone]   = useState(false);
  const [comment,  setComment]  = useState('');
  const [copied,        setCopied]        = useState(false);

  const lastResult = useRef<SajuResult | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.removeItem('saju_year');
    localStorage.removeItem('saju_month');
    localStorage.removeItem('saju_day');
    localStorage.removeItem('saju_hour');
    localStorage.removeItem('saju_name');
    localStorage.removeItem('saju_gender');
    localStorage.removeItem('saju_lunar');
  }, []);

  function save() {
    localStorage.setItem('saju_year',  year);
    localStorage.setItem('saju_month', month);
    localStorage.setItem('saju_day',   day);
    localStorage.setItem('saju_hour',  hour);
    localStorage.setItem('saju_name',  name);
    localStorage.setItem('saju_gender',gender);
    localStorage.setItem('saju_lunar', lunar?'1':'0');
  }

  function doAnalyze() {
    const y = parseInt(year), m = parseInt(month), d = parseInt(day);
    if (!y||!m||!d) { alert('생년월일을 모두 입력해주세요.'); return; }
    if (y<1900||y>2025) { alert('년도는 1900~2025 사이로 입력해주세요.'); return; }
    let sy=y, sm=m, sd=d;
    if (lunar) {
      if (!_ms) { alert('음력 변환 로딩 중입니다. 잠시 후 다시 시도해주세요.'); return; }
      try { const sol=_ms.lunarToSolar(y,m,d,leapM); sy=sol.year; sm=sol.month; sd=sol.day; }
      catch { alert('음력 날짜 변환 실패. 날짜를 다시 확인해주세요.'); return; }
    }
    save();
    setLoading(true); setResult(null); setFortuneResult(null); setAiText(''); setShowFb(false); setFbDone(false);
    setTimeout(() => {
      const r = calculate({ year:sy, month:sm, day:sd, hourTotalMin:parseInt(hour), gender });
      lastResult.current = r;
      setResult(r);
      try { setFortuneResult(dailyFortune(r)); } catch { setFortuneResult(null); }
      setLoading(false);
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior:'smooth' }), 100);
    }, 600);
  }


  function askAI() {
    if (!lastResult.current) return;
    setAiLoad(true); setAiText(''); setShowFb(false); setFbDone(false);
    fetchStream(buildPrompt(lastResult.current), {
      onChunk: t => setAiText(p => p+t),
      onDone:  () => { setAiLoad(false); setShowFb(true); },
      onError: () => { setAiText('AI 연결에 실패했습니다. 잠시 후 다시 시도해주세요.'); setAiLoad(false); },
    });
  }


  function copyResult() {
    if (!result) return;
    const r = result;
    const pillarLabels = ['연주','월주','일주','시주'];
    const pillarText = r.pillars.map((p, i) =>
      p ? `${pillarLabels[i]}: ${STEMS[p.s]}${BRANCHES[p.b]}` : `${pillarLabels[i]}: 미입력`
    ).join(' | ');
    const yb = r.pillars[0]?.b ?? 0;
    const lines = [
      `■ ${name||'사주'} 님의 사주팔자 분석`,
      `생년월일: ${r.input.year}년 ${r.input.month}월 ${r.input.day}일 (${r.input.gender}성)`,
      ``,
      `[사주팔자]`,
      pillarText,
      ``,
      `띠: ${ZODIAC[yb]}띠 | 일간 오행: ${ELEM_NAMES[STEM_ELEM[r.pillars[2]?.s??0]]}`,
      ``,
      `[오행 분포]`,
      r.ohaeng.counts.map((c,i)=>`${ELEM_NAMES[i]} ${c}개`).join(' · '),
      `보완 오행: ${ELEM_NAMES[r.ohaeng.weakest]}`,
      ...(aiText ? [``, `[AI 심층 풀이]`, aiText] : []),
      ``,
      `— saju.coupax.co.kr`,
    ];
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function sendFeedback(rating:number) {
    if (!lastResult.current) return;
    const r = lastResult.current;
    const p0 = r.pillars[0];
    fetch('/api/feedback', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        saju: p0 ? `${STEMS[p0.s]}${BRANCHES[p0.b]}` : '',
        year:r.input.year, month:r.input.month, day:r.input.day, gender:r.input.gender,
        prompt:buildPrompt(r), response:aiText, rating, comment,
      }),
    }).catch(()=>{});
    setFbDone(true);
  }

  function buildShareUrl() {
    if (!result) return 'https://saju.coupax.co.kr';
    const p = new URLSearchParams({
      y: String(result.input.year),
      m: String(result.input.month),
      d: String(result.input.day),
      h: hour,
      g: gender,
    });
    if (name) p.set('n', name);
    return `https://saju.coupax.co.kr?${p.toString()}`;
  }

  function shareNative() {
    const url = buildShareUrl();
    const text = `${name||'나'}의 사주팔자 분석 결과를 확인해보세요!`;
    if (navigator.share) {
      navigator.share({ title:'사주팔자 무료 분석', text, url }).catch(()=>{});
    } else {
      navigator.clipboard.writeText(url).then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),2000); });
    }
  }

  function shareKakao() {
    const url = encodeURIComponent(buildShareUrl());
    const text = encodeURIComponent(`${name||'나'}의 사주팔자 분석 결과를 확인해보세요!`);
    window.open(`https://story.kakao.com/share?url=${url}&text=${text}`, 'kakaoShare', 'width=480,height=600');
  }

  function shareBand() {
    const url = encodeURIComponent(buildShareUrl());
    const text = encodeURIComponent(`${name||'나'}의 사주팔자 분석 결과`);
    window.open(`https://band.us/plugin/share?body=${text}%0A${url}&route=popup`,'bandShare','width=480,height=600');
  }

  function shareFacebook() {
    const url = encodeURIComponent(buildShareUrl());
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`,'fbShare','width=580,height=480');
  }

  function copyShareUrl() {
    navigator.clipboard.writeText(buildShareUrl()).then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),2000); });
  }

  const dp = result?.pillars[2] ?? null;
  const ds = dp?.s ?? 0;

  const yearBranch = result?.pillars[0]?.b ?? 0;

  return (
    <div>
      {result && !loading && <ZodiacBackground branch={yearBranch} />}
      <div style={{ position:'relative', zIndex:1 }}>
      {/* ── Header ── */}
      <header style={{
        display:'flex', justifyContent:'space-between', alignItems:'center',
        padding:'18px 32px', borderBottom:'1px solid var(--border)',
        backdropFilter:'blur(20px)', position:'sticky', top:0, zIndex:100,
        background:'rgba(13,11,30,.8)',
      }}>
        <a href="#" style={{ display:'flex', alignItems:'center', gap:10, textDecoration:'none', color:'var(--text)' }}>
          <div style={{ width:36, height:36, background:'linear-gradient(135deg,#8b6fc6,#4a9eff)',
            borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.1rem' }}>☯</div>
          <span style={{ fontWeight:800, fontSize:'1.1rem' }}>사주<span style={{ color:'var(--gold)' }}>팔자</span></span>
        </a>
      </header>

      {/* ── Hero / Form ── */}
      <section className="hero-section">
        <div style={{ display:'inline-block', background:'rgba(139,111,198,.2)',
          border:'1px solid rgba(139,111,198,.4)', color:'#c4a8ff',
          fontSize:'.78rem', fontWeight:700, padding:'5px 14px', borderRadius:100, marginBottom:22 }}>
          ✦ 무료 사주팔자 정밀 분석
        </div>
        <h1 style={{ fontSize:'clamp(1.8rem,5vw,2.8rem)', fontWeight:900, letterSpacing:-1, lineHeight:1.2, marginBottom:14 }}>
          나의 <span style={{ color:'var(--gold)' }}>사주팔자</span>를<br/>알아보세요
        </h1>
        <p style={{ color:'var(--muted)', fontSize:'.95rem', marginBottom:40 }}>
          생년월일·시간으로 60갑자 일주, 오행, 신살, 대운, {THIS_YEAR}년 운세를 상세하게 분석합니다.
        </p>

        <div className="form-card" style={{ background:'var(--card2)', border:'1px solid var(--border)',
          borderRadius:16, backdropFilter:'blur(20px)', textAlign:'left' }}>
          <div style={{ fontSize:'.9rem', fontWeight:700, color:'var(--gold)', marginBottom:20 }}>☽ 생년월일 입력</div>

          <div className="form-grid">
            <Field label="이름 (선택)">
              <input style={inputStyle} placeholder="홍길동" maxLength={10}
                value={name} onChange={e=>setName(e.target.value)} />
            </Field>
            <Field label="성별">
              <div style={{ display:'flex', gap:8 }}>
                {(['남','여'] as const).map(g=>(
                  <button key={g} onClick={()=>setGender(g)}
                    style={{ ...gBtnStyle, ...(gender===g?{borderColor:'var(--purple)',background:'rgba(139,111,198,.2)',color:'var(--text)'}:{}) }}>
                    {g}성
                  </button>
                ))}
              </div>
            </Field>

            <div style={{ gridColumn:'1/-1' }}>
              <div style={{ fontSize:'.75rem', fontWeight:700, color:'var(--muted)', marginBottom:6 }}>생년월일</div>
              <div style={{ display:'flex', gap:6, marginBottom:8, alignItems:'center' }}>
                {[false,true].map(isL=>(
                  <button key={String(isL)} onClick={()=>setLunar(isL)}
                    style={{ ...calBtnStyle, ...(lunar===isL?{borderColor:'var(--purple)',background:'rgba(139,111,198,.2)',color:'var(--text)'}:{}) }}>
                    {isL?'음력':'양력'}
                  </button>
                ))}
                {lunar&&(
                  <label style={{ display:'flex', alignItems:'center', gap:4, fontSize:'.75rem', color:'var(--muted)', marginLeft:4, cursor:'pointer' }}>
                    <input type="checkbox" checked={leapM} onChange={e=>setLeapM(e.target.checked)} style={{ accentColor:'var(--purple)' }} />
                    윤달
                  </label>
                )}
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <input type="number" placeholder="년도 (예: 1990)" min={1900} max={2025}
                  value={year} onChange={e=>setYear(e.target.value)} style={{ ...inputStyle, flex:2 }} />
                <select value={month} onChange={e=>setMonth(e.target.value)} style={{ ...selectStyle, flex:1 }}>
                  <option value="">월</option>
                  {Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>{i+1}월</option>)}
                </select>
                <select value={day} onChange={e=>setDay(e.target.value)} style={{ ...selectStyle, flex:1 }}>
                  <option value="">일</option>
                  {Array.from({length:31},(_,i)=><option key={i+1} value={i+1}>{i+1}일</option>)}
                </select>
              </div>
            </div>

            <div style={{ gridColumn:'1/-1' }}>
              <div style={{ fontSize:'.75rem', fontWeight:700, color:'var(--muted)', marginBottom:6 }}>태어난 시간 (선택 · 30분 단위)</div>
              <select value={hour} onChange={e=>setHour(e.target.value)} style={selectStyle}>
                {HOUR_OPTIONS.map(o=><option key={o.v} value={o.v}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <button onClick={doAnalyze} style={{
            width:'100%', marginTop:20, padding:15,
            background:'linear-gradient(135deg,#7c4fc4,#4a9eff)', border:'none',
            borderRadius:10, color:'#fff', fontSize:'.98rem', fontWeight:700, cursor:'pointer',
          }}>✦ 사주팔자 정밀 분석하기</button>
        </div>
      </section>

      {/* ── Loading ── */}
      {loading&&(
        <div style={{ textAlign:'center', padding:'48px 0' }}>
          <div style={{ width:46, height:46, border:'3px solid rgba(255,255,255,.1)',
            borderTopColor:'var(--gold)', borderRadius:'50%',
            animation:'spin .8s linear infinite', margin:'0 auto 14px' }} />
          <p style={{ color:'var(--muted)', fontSize:'.88rem' }}>사주를 정밀 분석 중입니다...</p>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {/* ── Results ── */}
      {result&&!loading&&(
        <div ref={resultsRef} className="results-section">
          <div style={{ textAlign:'center', paddingTop:52, marginBottom:28 }}>
            <div style={{ fontSize:'.82rem', color:'var(--muted)', marginBottom:6 }}>{(name||'당신')} 님의 사주 정밀 분석</div>
            <h2 style={{ fontSize:'1.4rem', fontWeight:800 }}>
              <span style={{ color:'var(--gold)' }}>{dp&&STEMS[dp.s]}{dp&&BRANCHES[dp.b]}일주</span>
              {dp&&` — ${getIljooDesc(dp).split('.')[0]}`}
            </h2>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center', marginTop:14 }}>
              <button onClick={copyResult} style={{
                padding:'7px 18px',
                background: copied ? 'rgba(76,190,130,.2)' : 'rgba(255,255,255,.07)',
                border: `1px solid ${copied ? 'rgba(76,190,130,.5)' : 'var(--border)'}`,
                borderRadius:100, color: copied ? '#4cbe82' : 'var(--muted)',
                fontSize:'.8rem', fontWeight:700, cursor:'pointer', transition:'all .25s',
              }}>
                {copied ? '✓ 복사됨!' : '📋 결과 복사'}
              </button>
              <button onClick={shareNative} style={{
                padding:'7px 18px', background:'rgba(255,255,255,.07)',
                border:'1px solid var(--border)', borderRadius:100,
                color:'var(--muted)', fontSize:'.8rem', fontWeight:700, cursor:'pointer',
              }}>📤 공유</button>
              <button onClick={shareKakao} style={{
                padding:'7px 18px', background:'rgba(254,229,0,.15)',
                border:'1px solid rgba(254,229,0,.4)', borderRadius:100,
                color:'#f5d500', fontSize:'.8rem', fontWeight:700, cursor:'pointer',
              }}>💬 카카오</button>
              <button onClick={shareBand} style={{
                padding:'7px 18px', background:'rgba(62,193,117,.15)',
                border:'1px solid rgba(62,193,117,.4)', borderRadius:100,
                color:'#3ec175', fontSize:'.8rem', fontWeight:700, cursor:'pointer',
              }}>🎵 밴드</button>
              <button onClick={shareFacebook} style={{
                padding:'7px 18px', background:'rgba(24,119,242,.15)',
                border:'1px solid rgba(24,119,242,.4)', borderRadius:100,
                color:'#4a90e2', fontSize:'.8rem', fontWeight:700, cursor:'pointer',
              }}>📘 페이스북</button>
              <button onClick={copyShareUrl} style={{
                padding:'7px 18px', background:'rgba(74,158,255,.12)',
                border:'1px solid rgba(74,158,255,.35)', borderRadius:100,
                color:'#4a9eff', fontSize:'.8rem', fontWeight:700, cursor:'pointer',
              }}>🔗 링크 복사</button>
            </div>
          </div>

          <PillarGrid pillars={result.pillars} />
          <ScoreCards ds={ds} />
          {fortuneResult && <DailyFortuneCard fortune={fortuneResult} />}
          {dp&&<IljooCard dp={dp} yearBranch={result.pillars[0]?.b ?? 0} />}
          <OhaengCard ohaeng={result.ohaeng} />

          {/* 탭 */}
          <div style={{ display:'flex', gap:7, marginBottom:16, flexWrap:'wrap' }}>
            {TAB_NAMES.map(t=>(
              <button key={t} onClick={()=>setTab(t)} style={{
                padding:'7px 15px', borderRadius:100, cursor:'pointer', fontSize:'.82rem', fontWeight:600,
                border:`1px solid ${tab===t?'var(--purple)':'var(--border)'}`,
                background: tab===t?'rgba(139,111,198,.2)':'var(--card)',
                color: tab===t?'var(--text)':'var(--muted)',
              }}>{t}</button>
            ))}
          </div>

          <div style={cardStyle}>
            {tab==='성격'&&dp&&<TabSung ds={ds} dp={dp} />}
            {tab==='운세'&&<TabFortune ds={ds} />}
            {tab==='신살'&&<TabShinsal shinsal={result.shinsal} />}
            {tab==='대운'&&<TabDaeun daeun={result.daeun} birthYear={result.input.year} />}
            {tab==='월별'&&<TabMonthly ds={ds} />}
            {tab==='직업'&&<TabJob ds={ds} />}
            {tab==='건강'&&<TabHealth ds={ds} />}
          </div>

          {/* AI 풀이 */}
          <div style={{ margin:'28px 0', background:'rgba(139,111,198,.1)',
            border:'1px solid rgba(139,111,198,.3)', borderRadius:16, padding:28 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
              <span style={{ fontSize:'1.3rem' }}>✦</span>
              <span style={{ fontWeight:800, fontSize:'1rem', color:'var(--gold)' }}>AI 심층 풀이</span>
              <span style={{ fontSize:'.72rem', color:'var(--muted)', background:'rgba(255,255,255,.07)', padding:'2px 8px', borderRadius:20 }}>
                Gemini 2.5 Flash
              </span>
            </div>

            {/* 사주 도표 */}
            <div style={{ display:'flex', flexWrap:'wrap', gap:20, justifyContent:'center',
              padding:'18px 12px', background:'rgba(0,0,0,.15)', borderRadius:12, marginBottom:18 }}>
              <OhaengRadar counts={result.ohaeng.counts} />
              <div style={{ width:1, background:'rgba(255,255,255,.08)', alignSelf:'stretch' }} />
              <div style={{ display:'flex', flexDirection:'column', justifyContent:'center', gap:24 }}>
                <SinGangGauge pillars={result.pillars} dayStemIdx={ds} />
                <SipsinGrid   pillars={result.pillars} dayStemIdx={ds} />
              </div>
            </div>

            <div style={{ display:'flex', gap:10, flexWrap:'wrap', justifyContent:'center' }}>
              <button onClick={askAI} disabled={aiLoading} style={{
                background:'linear-gradient(135deg,#6b4fa0,#3a7bd5)', border:'none',
                borderRadius:10, color:'#fff', fontSize:'.92rem', fontWeight:700,
                padding:'12px 24px', cursor:aiLoading?'not-allowed':'pointer', opacity:aiLoading?.7:1,
              }}>
                {aiLoading?'✦ 분석 중...':aiText?'✦ 다시 분석하기':'✦ AI 풀이 받기'}
              </button>
            </div>

            {/* 프리미엄 게이트 모달 */}

            {(aiText||aiLoading)&&(
              <AiRenderer text={aiText} loading={aiLoading} result={result} />
            )}

            {showFb&&!fbDone&&(
              <div style={{ marginTop:16 }}>
                <p style={{ fontSize:'.82rem', color:'var(--muted)', marginBottom:10 }}>이 풀이가 도움이 됐나요?</p>
                <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                  <button onClick={()=>sendFeedback(1)} style={{ background:'rgba(76,190,130,.15)',border:'1px solid rgba(76,190,130,.4)',borderRadius:8,color:'#4cbe82',padding:'7px 18px',cursor:'pointer',fontSize:'.85rem' }}>👍 도움됐어요</button>
                  <button onClick={()=>sendFeedback(-1)} style={{ background:'rgba(224,85,85,.15)',border:'1px solid rgba(224,85,85,.4)',borderRadius:8,color:'#e05555',padding:'7px 18px',cursor:'pointer',fontSize:'.85rem' }}>👎 별로예요</button>
                  <input placeholder="한마디 (선택)" value={comment} onChange={e=>setComment(e.target.value)}
                    style={{ flex:1,minWidth:160,background:'rgba(255,255,255,.06)',border:'1px solid var(--border)',borderRadius:8,padding:'7px 12px',color:'var(--text)',fontSize:'.85rem',outline:'none' }} />
                </div>
              </div>
            )}
            {fbDone&&<p style={{ marginTop:10, fontSize:'.82rem', color:'#4cbe82' }}>✓ 피드백 저장됐습니다. 감사합니다!</p>}
          </div>
        </div>
      )}

      <footer style={{ textAlign:'center', padding:'36px 20px', color:'var(--muted)', fontSize:'.78rem', borderTop:'1px solid var(--border)', marginTop:40 }}>
        <p>사주팔자 무료 정밀 분석 | 본 결과는 전통 동양 철학 기반 참고용 정보입니다.</p>
        <p style={{ marginTop:8, fontSize:'.72rem', opacity:.6 }}>
          이 서비스는{' '}
          <a href="https://github.com/rath/orrery" target="_blank" rel="noopener noreferrer"
            style={{ color:'var(--muted)', textDecoration:'underline' }}>@orrery/core (AGPL-3.0)</a>
          를 사용합니다.{' '}
          <a href="https://github.com/pwcosmos-create/saju-v2" target="_blank" rel="noopener noreferrer"
            style={{ color:'var(--muted)', textDecoration:'underline' }}>소스코드 공개</a>
        </p>
      </footer>
      </div>{/* /z-index wrapper */}
      <ChatWidget result={result} />
    </div>
  );
}

// ─── 사주팔자 그리드 ───
function PillarGrid({ pillars }: { pillars:(Pillar|null)[] }) {
  const labels = ['연주 年柱','월주 月柱','일주 日柱','시주 時柱'];
  const sG = ['linear-gradient(135deg,#4cbe82,#2a8c58)','linear-gradient(135deg,#e05555,#b03030)','linear-gradient(135deg,#e8c46a,#c09030)','linear-gradient(135deg,#4a9eff,#2060cc)'];
  const bG = ['linear-gradient(135deg,#3a9e72,#1e7a48)','linear-gradient(135deg,#c04040,#8c2020)','linear-gradient(135deg,#d4b050,#a07820)','linear-gradient(135deg,#3080e0,#1a50b0)'];
  return (
    <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:'26px 20px 22px', marginBottom:16 }}>
      <div style={{ fontSize:'.72rem', fontWeight:700, color:'var(--muted)', textAlign:'center', marginBottom:18, letterSpacing:'.08em' }}>사주팔자 (四柱八字)</div>
      <div className="pillar-grid">
        {pillars.map((p,i)=>(
          <div key={i} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
            <div style={{ fontSize:'.65rem', color:'var(--muted)', fontWeight:600, marginBottom:2 }}>{labels[i]}</div>
            {p?(
              <>
                <div style={{ width:54,height:54,borderRadius:11,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.35rem',fontWeight:900,background:sG[i],margin:'2px auto' }}>{STEMS_H[p.s]}</div>
                <div style={{ width:54,height:54,borderRadius:11,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.35rem',fontWeight:900,background:bG[i],margin:'2px auto' }}>{BRANCHES_H[p.b]}</div>
                <div style={{ fontSize:'.72rem',color:'var(--muted)' }}>{STEMS[p.s]}{BRANCHES[p.b]}</div>
                <div style={{ display:'flex',gap:3,flexWrap:'wrap',justifyContent:'center' }}>
                  <ElemBadge idx={STEM_ELEM[p.s]} />
                  <ElemBadge idx={BRANCH_ELEM[p.b]} />
                </div>
              </>
            ):(
              <>
                <div style={{ width:54,height:54,borderRadius:11,background:'rgba(255,255,255,.05)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--muted)',margin:'2px auto' }}>?</div>
                <div style={{ width:54,height:54,borderRadius:11,background:'rgba(255,255,255,.05)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--muted)',margin:'2px auto' }}>?</div>
                <div style={{ fontSize:'.72rem',color:'var(--muted)',opacity:.4 }}>미입력</div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ScoreCards({ ds }: { ds:number }) {
  const sc = SCORES_BY_STEM[ds];
  type ScoreKey = keyof typeof sc;
  const cats: {k:ScoreKey; icon:string; color:string}[] = [
    {k:'재물',icon:'💰',color:'#e8c46a'},{k:'연애',icon:'❤️',color:'#e05555'},
    {k:'건강',icon:'🌿',color:'#4cbe82'},{k:'직업',icon:'💼',color:'#4a9eff'},
  ];
  return (
    <div className="score-grid">
      {cats.map(c=>(
        <div key={c.k} style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:16, padding:'16px 12px', textAlign:'center' }}>
          <div style={{ fontSize:'1.3rem', marginBottom:6 }}>{c.icon}</div>
          <div style={{ fontSize:'.68rem', color:'var(--muted)', fontWeight:600, marginBottom:8 }}>{c.k}운</div>
          <div style={{ fontSize:'1.6rem', fontWeight:900, color:'var(--gold)', lineHeight:1 }}>{sc[c.k]}</div>
          <div style={{ height:5,background:'rgba(255,255,255,.08)',borderRadius:100,overflow:'hidden',marginTop:8 }}>
            <div style={{ height:'100%',borderRadius:100,background:c.color,width:`${sc[c.k]}%`,transition:'width 1.2s' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function IljooCard({ dp, yearBranch }: { dp:Pillar; yearBranch:number }) {
  const ds=dp.s, idx=getPillarIdx(dp.s,dp.b);
  return (
    <div className="iljoo-inner" style={{ background:'linear-gradient(135deg,rgba(139,111,198,.15),rgba(74,158,255,.1))',border:'1px solid rgba(139,111,198,.3)',borderRadius:16,padding:22,marginBottom:16 }}>
      <div style={{ fontSize:'2rem',fontWeight:900,color:'var(--gold)',minWidth:70,textAlign:'center',lineHeight:1 }}>
        {STEM_ICONS[ds]}<small style={{ display:'block',fontSize:'.68rem',color:'var(--muted)',marginTop:3 }}>{STEMS[ds]}{BRANCHES[dp.b]}일주</small>
      </div>
      <div>
        <h3 style={{ fontSize:'1rem',fontWeight:800,marginBottom:6 }}>{STEMS[ds]}{BRANCHES[dp.b]}일주 · 띠: {ZODIAC[yearBranch]}띠 · 일간 오행: {ELEM_NAMES[STEM_ELEM[ds]]}</h3>
        <p style={{ fontSize:'.85rem',color:'rgba(240,238,255,.85)',lineHeight:1.75 }}>{IJ60_DESC[idx]}</p>
        <div style={{ display:'flex',flexWrap:'wrap',gap:5,marginTop:10 }}>
          {KEYWORDS_BY_STEM[ds].map(k=>(
            <span key={k} style={{ background:'rgba(255,255,255,.07)',border:'1px solid rgba(255,255,255,.12)',borderRadius:100,padding:'3px 11px',fontSize:'.72rem',color:'var(--muted)' }}>{k}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function OhaengCard({ ohaeng }: { ohaeng:OhaengResult }) {
  const total=ohaeng.counts.reduce((a,b)=>a+b,0)||1;
  return (
    <div style={cardStyle}>
      <div style={{ fontSize:'.72rem',fontWeight:700,color:'var(--muted)',letterSpacing:'.07em',marginBottom:16 }}>오행 분석 (五行)</div>
      {ohaeng.counts.map((cnt,i)=>(
        <div key={i} style={{ display:'flex',alignItems:'center',gap:10,marginBottom:11 }}>
          <div style={{ minWidth:80 }}><ElemBadge idx={i} /></div>
          <div style={{ flex:1,height:7,background:'rgba(255,255,255,.08)',borderRadius:100,overflow:'hidden' }}>
            <div style={{ height:'100%',borderRadius:100,background:ELEM_COLORS[i],width:`${Math.round(cnt/total*100)}%`,transition:'width 1s' }} />
          </div>
          <div style={{ fontSize:'.8rem',fontWeight:700,minWidth:18,color:ELEM_COLORS[i] }}>{cnt}개</div>
        </div>
      ))}
      <div style={{ marginTop:10,fontSize:'.8rem',background:'rgba(232,196,106,.1)',border:'1px solid rgba(232,196,106,.3)',color:'var(--gold)',padding:'5px 13px',borderRadius:100,display:'inline-block' }}>
        ✦ 보완 필요 오행: <strong>{ELEM_NAMES[ohaeng.weakest]}({ELEM_NAMES_H[ohaeng.weakest]})</strong>
      </div>
      <div style={{ marginTop:14,paddingTop:14,borderTop:'1px solid var(--border)' }}>
        <p style={{ fontSize:'.83rem',color:'var(--muted)',lineHeight:1.7 }}>{ohaeng.detail}</p>
      </div>
    </div>
  );
}

function DailyFortuneCard({ fortune }: { fortune: DailyFortuneResult }) {
  const levelColors: Record<string, string> = {
    '매우 좋음': '#4cbe82', '좋음': '#82d9a8', '보통': '#e8c46a', '주의': '#e09050', '매우 주의': '#e05555',
  };
  const levelDots: Record<string, number> = {
    '매우 좋음': 5, '좋음': 4, '보통': 3, '주의': 2, '매우 주의': 1,
  };
  const color = levelColors[fortune.level] ?? 'var(--muted)';
  const dots  = levelDots[fortune.level] ?? 3;
  const cls   = fortune.classification;

  return (
    <div style={{ background:'linear-gradient(135deg,rgba(74,158,255,.08),rgba(139,111,198,.08))',
      border:'1px solid rgba(74,158,255,.3)', borderRadius:16, padding:22, marginBottom:16 }}>
      {/* 헤더 */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14, flexWrap:'wrap', gap:8 }}>
        <div>
          <div style={{ fontSize:'.72rem', color:'var(--muted)', marginBottom:4 }}>오늘의 운세 · {fortune.date}</div>
          <div style={{ fontSize:'1.1rem', fontWeight:800 }}>
            {STEMS_H[fortune.dayGanji.s]}{BRANCHES_H[fortune.dayGanji.b]}일
            <span style={{ fontSize:'.82rem', color:'var(--muted)', fontWeight:400, marginLeft:6 }}>
              ({STEMS[fortune.dayGanji.s]}{BRANCHES[fortune.dayGanji.b]})
            </span>
          </div>
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:'1.1rem', letterSpacing:2, color }}>
            {'●'.repeat(dots)}<span style={{ opacity:.25 }}>{'●'.repeat(5 - dots)}</span>
          </div>
          <div style={{ fontSize:'.82rem', fontWeight:700, color }}>{fortune.level}</div>
        </div>
      </div>

      {/* 배경 십신 */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14 }}>
        {([
          { label:'대운', val:fortune.background.daewoonSipsin },
          { label:'세운', val:fortune.background.yearSipsin },
          { label:'월운', val:fortune.background.monthSipsin },
        ] as const).map(({ label, val }) => (
          <div key={label} style={{ background:'rgba(255,255,255,.06)', border:'1px solid var(--border)',
            borderRadius:8, padding:'4px 10px', fontSize:'.75rem' }}>
            <span style={{ color:'var(--muted)' }}>{label} </span>
            <span style={{ fontWeight:700 }}>{val}</span>
          </div>
        ))}
      </div>

      {/* 일진 십신 + 행동 가이드 */}
      <div style={{ background:'rgba(255,255,255,.04)', border:'1px solid var(--border)',
        borderRadius:10, padding:'12px 14px', marginBottom:14 }}>
        <div style={{ fontSize:'.72rem', color:'var(--muted)', marginBottom:4 }}>일진 십신 · 행동 가이드</div>
        <div style={{ display:'flex', alignItems:'baseline', gap:10, flexWrap:'wrap' }}>
          <span style={{ fontSize:'1rem', fontWeight:800, color }}>{fortune.sipsin}</span>
          <span style={{ fontSize:'.85rem', color:'var(--muted)' }}>{fortune.action}</span>
        </div>
      </div>

      {/* 이벤트 뱃지 */}
      {fortune.events.length > 0 && (
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14 }}>
          {fortune.events.map((e, i) => {
            const bad = e.type === 'chung' || e.type === 'hyeong';
            const bg  = e.weakened ? 'rgba(255,255,255,.05)' : bad ? 'rgba(224,85,85,.15)' : 'rgba(76,190,130,.15)';
            const bd  = e.weakened ? '1px solid rgba(255,255,255,.15)' : bad ? '1px solid rgba(224,85,85,.4)' : '1px solid rgba(76,190,130,.4)';
            const tc  = e.weakened ? 'var(--muted)' : bad ? '#e05555' : '#4cbe82';
            const lbl = e.type === 'chung' ? '충(沖)' : e.type === 'yughap' ? '육합' : e.type === 'samhap' ? '삼합' : '형(刑)';
            return (
              <span key={i} style={{ background:bg, border:bd, borderRadius:100, padding:'3px 10px',
                fontSize:'.72rem', color:tc, textDecoration:e.weakened?'line-through':'none', opacity:e.weakened?.6:1 }}>
                {lbl}{e.hwaCandidate ? '·합화?' : ''}
              </span>
            );
          })}
        </div>
      )}

      {/* 한줄 요약 */}
      <div style={{ fontSize:'.83rem', color:'var(--muted)', borderTop:'1px solid var(--border)', paddingTop:10, lineHeight:1.6 }}>
        {fortune.oneLiner}
      </div>

      {/* 용신/기신 태그 */}
      <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:10, alignItems:'center' }}>
        <span style={{ fontSize:'.7rem', color:'var(--muted)' }}>용신</span>
        <ElemBadge idx={cls.yongsin} />
        <span style={{ fontSize:'.7rem', color:'var(--muted)', marginLeft:4 }}>기신</span>
        {cls.gisin.map(e => <ElemBadge key={e} idx={e} />)}
      </div>
    </div>
  );
}

function TabSung({ ds, dp }: { ds:number; dp:Pillar }) {
  const el=STEM_ELEM[ds];
  const elemChars=['목(木)의 기운은 봄처럼 새로운 시작과 성장을 상징합니다.','화(火)의 기운은 태양처럼 밝음과 열정을 상징합니다.','토(土)의 기운은 대지처럼 안정과 포용을 상징합니다.','금(金)의 기운은 가을처럼 결실과 결단을 상징합니다.','수(水)의 기운은 물처럼 지혜와 유연함을 상징합니다.'];
  return (
    <div>
      <h3 style={{ fontSize:'.98rem',fontWeight:700,marginBottom:12,color:'var(--gold)' }}>{STEM_ICONS[ds]} {STEMS[ds]}일간 성격 상세 분석</h3>
      <p style={{ fontSize:'.87rem',color:'rgba(240,238,255,.85)',lineHeight:1.8,marginBottom:14 }}>{IJ60_DESC[getPillarIdx(dp.s,dp.b)]}</p>
      <div className="tab-grid-2">
        {[
          {ico:'💼',t:'직업 적성',txt:`${ELEM_NAMES[el]}(${ELEM_NAMES_H[el]}) 기운: ${elemChars[el]}`},
          {ico:'❤️',t:'연애 스타일',txt:ds<5?'한번 마음을 주면 깊게 헌신하는 타입입니다. 내면은 따뜻하고 진지합니다.':'감성적이고 섬세한 사랑을 추구합니다. 공감 능력이 뛰어납니다.'},
          {ico:'💰',t:'재물 성향',txt:el%2===0?'재물을 체계적으로 모으는 능력이 뛰어납니다. 안정적인 저축과 투자를 선호합니다.':'재물 기회가 많지만 지출도 많습니다. 꼼꼼한 수입·지출 관리가 필요합니다.'},
          {ico:'🌿',t:'건강 주의',txt:['관절·근육·간 건강에 유의하세요.','심장·혈액·혈압에 유의하세요.','소화기·위장에 유의하세요.','폐·기관지·피부에 유의하세요.','신장·방광·뼈에 유의하세요.'][el]},
        ].map(c=>(
          <div key={c.t} style={{ background:'rgba(255,255,255,.04)',border:'1px solid var(--border)',borderRadius:10,padding:14 }}>
            <div style={{ fontSize:'.72rem',fontWeight:700,color:'var(--muted)',marginBottom:5 }}>{c.ico} {c.t}</div>
            <p style={{ fontSize:'.8rem',color:'var(--muted)',lineHeight:1.6 }}>{c.txt}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function TabFortune({ ds }: { ds:number }) {
  const yg = yearGanji(THIS_YEAR);
  const yearTitle = `${THIS_YEAR} ${STEMS[yg.s]}${BRANCHES[yg.b]}년(${STEMS_H[yg.s]}${BRANCHES_H[yg.b]}年)`;
  return (
    <div>
      <h3 style={{ fontSize:'.98rem',fontWeight:700,marginBottom:12,color:'var(--gold)' }}>{ZODIAC_EMOJI[yg.b]} {yearTitle} 운세</h3>
      <p style={{ fontSize:'.87rem',color:'rgba(240,238,255,.85)',lineHeight:1.8 }}>{F2026_BY_STEM[ds]}</p>
    </div>
  );
}

function TabShinsal({ shinsal }: { shinsal:Shinsal[] }) {
  return (
    <div>
      <h3 style={{ fontSize:'.98rem',fontWeight:700,marginBottom:12,color:'var(--gold)' }}>✦ 신살 분석 (神殺)</h3>
      {shinsal.length===0
        ?<p style={{ fontSize:'.85rem',color:'var(--muted)',textAlign:'center',padding:'20px 0' }}>🔍 강하게 발현된 신살이 없습니다.</p>
        :shinsal.map(s=>(
          <div key={s.name} style={{ background:'rgba(255,255,255,.04)',border:'1px solid var(--border)',borderRadius:10,padding:16,marginBottom:10 }}>
            <div style={{ fontSize:'.88rem',fontWeight:700,marginBottom:6,color:'var(--gold)' }}>{s.icon} {s.name}</div>
            <div style={{ fontSize:'.82rem',color:'var(--muted)',lineHeight:1.7 }}>{s.desc}</div>
          </div>
        ))
      }
    </div>
  );
}

function TabDaeun({ daeun, birthYear }: { daeun:DaeunResult; birthYear:number }) {
  const thisYear=THIS_YEAR, dir=daeun.forward?'순행(順行)':'역행(逆行)';
  return (
    <div>
      <h3 style={{ fontSize:'.98rem',fontWeight:700,marginBottom:6,color:'var(--gold)' }}>🔄 대운 흐름 (大運)</h3>
      <p style={{ fontSize:'.83rem',color:'var(--muted)',marginBottom:16 }}>방향: <strong style={{ color:'var(--gold)' }}>{dir}</strong></p>
      <div style={{ display:'flex',gap:8,overflowX:'auto',paddingBottom:8 }}>
        {daeun.pillars.map((p,i)=>{
          const age=daeun.startAge+i*10, startY=birthYear+age, endY=startY+9;
          const isCur=thisYear>=startY&&thisYear<=endY;
          const ec=ELEM_COLORS[STEM_ELEM[p.s]];
          return (
            <div key={i} style={{ minWidth:80,border:`1px solid ${isCur?'var(--gold)':'var(--border)'}`,background:isCur?'rgba(232,196,106,.08)':'rgba(255,255,255,.04)',borderRadius:10,padding:'12px 8px',textAlign:'center',flexShrink:0 }}>
              <div style={{ fontSize:'.65rem',color:'var(--muted)',marginBottom:6 }}>{age}세<br/><span style={{ fontSize:'.6rem' }}>{startY}~{endY}</span></div>
              <div style={{ fontSize:'1.1rem',fontWeight:800,color:ec }}>{STEMS_H[p.s]}</div>
              <div style={{ fontSize:'1.1rem',fontWeight:800,color:ELEM_COLORS[BRANCH_ELEM[p.b]] }}>{BRANCHES_H[p.b]}</div>
              <div style={{ fontSize:'.68rem',color:'var(--muted)',marginTop:3 }}>{STEMS[p.s]}{BRANCHES[p.b]}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TabMonthly({ ds }: { ds:number }) {
  const el=STEM_ELEM[ds];
  const words=['활기찬 시작','안정적 성장','도약의 기회','새로운 전환','기회 포착','신중한 판단','힘찬 전진','활발한 소통','결실의 수확','인내와 다짐','반전의 기운','마무리와 준비'];
  const stars=[4,3,5,4,5,3,4,4,3,4,5,4];
  return (
    <div>
      <h3 style={{ fontSize:'.98rem',fontWeight:700,marginBottom:16,color:'var(--gold)' }}>📅 {THIS_YEAR}년 월별 운세</h3>
      <div className="monthly-grid">
        {Array.from({length:12},(_,i)=>{
          const v=Math.min(5,Math.max(1,((stars[i]+el+i)%3)+3));
          return (
            <div key={i} style={{ background:'rgba(255,255,255,.04)',border:'1px solid var(--border)',borderRadius:10,padding:'13px 10px' }}>
              <div style={{ fontSize:'.7rem',color:'var(--muted)',marginBottom:4,fontWeight:600 }}>{i+1}월</div>
              <div style={{ fontSize:'.68rem',color:'var(--gold)',marginBottom:4 }}>{'★'.repeat(v)}{'☆'.repeat(5-v)}</div>
              <div style={{ fontSize:'.82rem',fontWeight:700,marginBottom:4 }}>{words[(i+el)%12]}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TabJob({ ds }: { ds:number }) {
  return (
    <div>
      <h3 style={{ fontSize:'.98rem',fontWeight:700,marginBottom:12,color:'var(--gold)' }}>💼 적합 직업 & 진로</h3>
      <div style={{ marginBottom:16 }}>
        {JOBS_BY_STEM[ds].map(j=>(
          <span key={j} style={{ display:'inline-block',background:'rgba(139,111,198,.15)',border:'1px solid rgba(139,111,198,.3)',borderRadius:100,padding:'4px 13px',margin:3,fontSize:'.82rem' }}>{j}</span>
        ))}
      </div>
      <div style={{ borderTop:'1px solid var(--border)',paddingTop:14,marginTop:6 }}>
        <div style={{ fontSize:'.82rem',fontWeight:700,color:'var(--muted)',marginBottom:6 }}>⚠️ 직업 선택 시 유의점</div>
        <p style={{ fontSize:'.82rem',color:'var(--muted)',lineHeight:1.7,marginBottom:14 }}>
          {['강한 독립심이 장점이지만 팀워크 환경에서는 마찰이 생길 수 있습니다. 리더 역할을 맡되 타인의 의견을 경청하는 자세가 중요합니다.','강한 독립심이 장점이지만 팀워크 환경에서는 마찰이 생길 수 있습니다. 리더 역할을 맡되 타인의 의견을 경청하는 자세가 중요합니다.','에너지를 다방면에 분산하는 경향이 있습니다. 커리어 목표를 명확히 설정하고 핵심 역량을 집중 개발하세요.','에너지를 다방면에 분산하는 경향이 있습니다. 커리어 목표를 명확히 설정하고 핵심 역량을 집중 개발하세요.','안정을 추구하는 성향이 도전을 가로막을 수 있습니다. 계획된 범위 내에서의 도전도 성장의 기회입니다.','안정을 추구하는 성향이 도전을 가로막을 수 있습니다. 계획된 범위 내에서의 도전도 성장의 기회입니다.','완벽주의로 인해 의사결정이 지연될 수 있습니다. 80점의 빠른 실행이 100점의 늦은 실행보다 나을 때가 많습니다.','완벽주의로 인해 의사결정이 지연될 수 있습니다. 80점의 빠른 실행이 100점의 늦은 실행보다 나을 때가 많습니다.','감정 기복이 업무 집중력에 영향을 줄 수 있습니다. 루틴을 만들어 감정과 업무를 분리하는 훈련이 도움이 됩니다.','감정 기복이 업무 집중력에 영향을 줄 수 있습니다. 루틴을 만들어 감정과 업무를 분리하는 훈련이 도움이 됩니다.'][ds]}
        </p>
        <div style={{ fontSize:'.82rem',fontWeight:700,color:'var(--muted)',marginBottom:6 }}>🤝 궁합 좋은 띠</div>
        <p style={{ fontSize:'.82rem',color:'var(--muted)',lineHeight:1.7 }}>
          {['원숭이(신)띠, 용(진)띠, 쥐(자)띠와 궁합이 좋습니다.','을목(乙): 개(술)띠, 말(오)띠, 돼지(해)띠와 궁합이 좋습니다.','호랑이(인)띠, 말(오)띠, 개(술)띠와 궁합이 좋습니다.','말(오)띠, 개(술)띠, 호랑이(인)띠와 궁합이 좋습니다.','닭(유)띠, 뱀(사)띠, 소(축)띠와 궁합이 좋습니다.','닭(유)띠, 뱀(사)띠, 소(축)띠와 궁합이 좋습니다.','뱀(사)띠, 닭(유)띠, 소(축)띠와 궁합이 좋습니다.','뱀(사)띠, 닭(유)띠, 소(축)띠와 궁합이 좋습니다.','원숭이(신)띠, 쥐(자)띠, 용(진)띠와 궁합이 좋습니다.','토끼(묘)띠, 돼지(해)띠, 양(미)띠와 궁합이 좋습니다.'][ds]}
        </p>
      </div>
    </div>
  );
}

const HEALTH_BY_STEM: {organ:string; tip:string; food:string; exercise:string}[] = [
  { organ:'간·담낭·근육·눈',  tip:'봄철 피로와 눈 충혈에 주의. 스트레스가 간에 직접 영향을 줍니다.',         food:'부추·쑥·녹색채소·신맛 음식',   exercise:'스트레칭·요가·등산' },
  { organ:'간·담낭·신경·관절', tip:'과로와 음주를 삼가고, 규칙적인 수면이 특히 중요합니다.',                 food:'결명자·오미자·신맛 식품',       exercise:'필라테스·자전거·수영' },
  { organ:'심장·소장·혈관·혀', tip:'여름철 열사병·고혈압에 주의. 흥분과 과로를 피하세요.',                   food:'토마토·수박·붉은 팥·쓴맛 식품', exercise:'걷기·수영·태극권' },
  { organ:'심장·혈압·망막·혀', tip:'감정 기복이 심할수록 심혈관에 부담. 명상과 휴식이 보약입니다.',          food:'산사·홍삼·오메가3',             exercise:'저강도 유산소·명상' },
  { organ:'비장·위장·근육·입', tip:'소화 불량과 과식에 주의. 습하고 차가운 음식을 줄이세요.',               food:'황색 곡물·호박·고구마·단맛 자제',exercise:'빠른 걷기·등산·복근 운동' },
  { organ:'비위·췌장·림프·입', tip:'당뇨와 부종에 취약. 단 음식 과다 섭취를 삼가세요.',                     food:'현미·보리·잡곡·쓴맛 채소',     exercise:'스쿼트·수영·필라테스' },
  { organ:'폐·대장·피부·코',   tip:'가을철 건조함과 호흡기 질환에 주의. 금연·금주가 필수입니다.',             food:'배·무·도라지·매운맛 식품 절제', exercise:'달리기·등산·심호흡' },
  { organ:'폐·기관지·피부·코', tip:'알레르기·피부 트러블에 민감. 실내 공기 관리를 철저히 하세요.',           food:'생강차·도라지·연근',            exercise:'걷기·호흡 운동·수영' },
  { organ:'신장·방광·뼈·귀',   tip:'겨울철 체력 저하와 요통에 주의. 과로와 냉기 노출을 피하세요.',           food:'검은콩·검은깨·해산물·짠맛 절제',exercise:'수영·자전거·코어 강화' },
  { organ:'신장·생식기·뼈·귀', tip:'냉증과 호르몬 불균형에 취약. 따뜻하게 하체를 보호하세요.',               food:'흑임자죽·우엉·마·굴',           exercise:'요가·걷기·반신욕' },
];

function TabHealth({ ds }: { ds:number }) {
  const h = HEALTH_BY_STEM[ds];
  const items = [
    { icon:'🫁', label:'주의 장기', value:h.organ },
    { icon:'⚠️', label:'건강 포인트', value:h.tip },
    { icon:'🥗', label:'좋은 음식', value:h.food },
    { icon:'🏃', label:'추천 운동', value:h.exercise },
  ];
  return (
    <div>
      <h3 style={{ fontSize:'.98rem',fontWeight:700,marginBottom:14,color:'var(--gold)' }}>🌿 건강 분석 & 관리법</h3>
      <div className="tab-grid-2">
        {items.map(it=>(
          <div key={it.label} style={{ background:'rgba(76,190,130,.07)',border:'1px solid rgba(76,190,130,.2)',borderRadius:10,padding:14 }}>
            <div style={{ fontSize:'.72rem',fontWeight:700,color:'#4cbe82',marginBottom:5 }}>{it.icon} {it.label}</div>
            <p style={{ fontSize:'.82rem',color:'var(--muted)',lineHeight:1.65 }}>{it.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// 12간지 동물 SVG 실선 경로 (viewBox 0 0 100 100)
const ZODIAC_SVG_PATHS: string[] = [
  // 0: 쥐
  `<ellipse cx="50" cy="60" rx="28" ry="22"/><circle cx="50" cy="34" r="20"/>
   <circle cx="34" cy="18" r="12"/><circle cx="66" cy="18" r="12"/>
   <circle cx="43" cy="30" r="3"/><circle cx="57" cy="30" r="3"/>
   <circle cx="50" cy="40" r="2.5"/>
   <line x1="22" y1="37" x2="46" y2="40"/><line x1="22" y1="43" x2="46" y2="43"/>
   <line x1="78" y1="37" x2="54" y2="40"/><line x1="78" y1="43" x2="54" y2="43"/>
   <path d="M78 66 Q95 60 90 46 Q87 36 98 28"/>
   <ellipse cx="36" cy="80" rx="12" ry="7"/><ellipse cx="64" cy="80" rx="12" ry="7"/>`,
  // 1: 소
  `<rect x="22" y="52" width="56" height="36" rx="10"/><rect x="28" y="22" width="44" height="36" rx="12"/>
   <path d="M32 28 Q14 12 8 22 Q10 32 22 28"/><path d="M68 28 Q86 12 92 22 Q90 32 78 28"/>
   <circle cx="40" cy="36" r="3.5"/><circle cx="60" cy="36" r="3.5"/>
   <ellipse cx="50" cy="50" rx="12" ry="7"/>
   <line x1="45" y1="55" x2="42" y2="62"/><line x1="55" y1="55" x2="58" y2="62"/>
   <line x1="32" y1="88" x2="32" y2="100"/><line x1="44" y1="88" x2="44" y2="100"/>
   <line x1="56" y1="88" x2="56" y2="100"/><line x1="68" y1="88" x2="68" y2="100"/>`,
  // 2: 호랑이
  `<ellipse cx="50" cy="62" rx="32" ry="26"/><circle cx="50" cy="30" r="24"/>
   <path d="M32 16 Q28 6 35 10"/><path d="M68 16 Q72 6 65 10"/>
   <circle cx="40" cy="26" r="4"/><circle cx="60" cy="26" r="4"/>
   <path d="M42 38 Q46 42 50 40 Q54 42 58 38"/>
   <line x1="18" y1="32" x2="44" y2="36"/><line x1="18" y1="38" x2="44" y2="40"/>
   <line x1="82" y1="32" x2="56" y2="36"/><line x1="82" y1="38" x2="56" y2="40"/>
   <line x1="35" y1="54" x2="65" y2="54"/><line x1="38" y1="63" x2="62" y2="63"/>
   <line x1="33" y1="72" x2="67" y2="72"/>
   <line x1="38" y1="88" x2="36" y2="100"/><line x1="62" y1="88" x2="64" y2="100"/>`,
  // 3: 토끼
  `<ellipse cx="50" cy="66" rx="30" ry="24"/><circle cx="50" cy="40" r="20"/>
   <path d="M36 22 Q30 2 34 0 Q40 -2 40 18"/><path d="M64 22 Q70 2 66 0 Q60 -2 60 18"/>
   <circle cx="42" cy="37" r="3.5"/><circle cx="58" cy="37" r="3.5"/>
   <circle cx="50" cy="46" r="4"/>
   <line x1="26" y1="44" x2="46" y2="46"/><line x1="26" y1="49" x2="46" y2="48"/>
   <line x1="74" y1="44" x2="54" y2="46"/><line x1="74" y1="49" x2="54" y2="48"/>
   <circle cx="80" cy="66" r="9"/>
   <line x1="38" y1="90" x2="36" y2="100"/><line x1="62" y1="90" x2="64" y2="100"/>`,
  // 4: 용
  `<path d="M15 85 Q20 68 34 56 Q46 44 56 36 Q68 26 80 18" stroke-width="3"/>
   <circle cx="82" cy="16" r="13"/>
   <path d="M74 7 Q68 0 74 3"/><path d="M90 7 Q96 0 90 4"/>
   <circle cx="77" cy="13" r="3"/><circle cx="87" cy="13" r="3"/>
   <path d="M76 22 Q73 27 77 26"/><path d="M88 22 Q91 27 87 26"/>
   <path d="M44 44 Q37 32 45 27 Q52 34 44 44"/>
   <path d="M60 36 Q54 24 63 19 Q68 27 60 36"/>
   <path d="M15 85 Q5 90 12 97 Q20 103 26 94"/>
   <path d="M12 76 Q2 79 6 89"/>
   <path d="M34 56 Q29 67 38 72 Q43 62 34 56"/>`,
  // 5: 뱀
  `<path d="M10 20 Q22 30 17 46 Q12 62 30 72 Q50 84 62 72 Q78 60 72 44 Q66 30 84 22" stroke-width="4.5"/>
   <ellipse cx="9" cy="17" rx="10" ry="7" transform="rotate(-20,9,17)"/>
   <circle cx="5" cy="13" r="2.5"/><circle cx="13" cy="12" r="2.5"/>
   <path d="M9 22 Q5 28 3 25 M9 22 Q13 28 16 25"/>`,
  // 6: 말
  `<path d="M28 95 L28 62 Q28 44 46 38 L58 36 Q72 36 72 52 L72 68 Q80 76 82 95"/>
   <path d="M46 38 Q44 22 38 14 Q50 8 56 20 L58 36"/>
   <path d="M38 14 Q30 8 26 16 Q30 22 38 14"/>
   <circle cx="42" cy="20" r="2.5"/><circle cx="50" cy="18" r="2.5"/>
   <path d="M36 24 Q32 28 34 32 Q38 30 36 24"/>
   <path d="M72 52 Q84 46 86 36 Q80 30 74 40"/>
   <line x1="28" y1="95" x2="28" y2="102"/><line x1="38" y1="93" x2="38" y2="102"/>
   <line x1="72" y1="95" x2="72" y2="102"/><line x1="82" y1="95" x2="82" y2="102"/>`,
  // 7: 양
  `<ellipse cx="50" cy="66" rx="32" ry="24"/><circle cx="50" cy="36" r="22"/>
   <path d="M34 22 Q26 8 34 14 Q40 20 34 22"/><path d="M66 22 Q74 8 66 14 Q60 20 66 22"/>
   <circle cx="42" cy="32" r="3.5"/><circle cx="58" cy="32" r="3.5"/>
   <path d="M44 46 Q50 52 56 46"/><path d="M46 52 Q50 56 54 52"/>
   <path d="M46 40 Q50 44 54 40"/>
   <ellipse cx="50" cy="60" rx="8" ry="5"/>
   <line x1="36" y1="90" x2="34" y2="100"/><line x1="48" y1="90" x2="46" y2="100"/>
   <line x1="52" y1="90" x2="54" y2="100"/><line x1="64" y1="90" x2="66" y2="100"/>`,
  // 8: 원숭이
  `<ellipse cx="50" cy="64" rx="26" ry="20"/><circle cx="50" cy="36" r="22"/>
   <circle cx="34" cy="32" r="11"/><circle cx="66" cy="32" r="11"/>
   <ellipse cx="50" cy="42" rx="15" ry="10"/>
   <circle cx="43" cy="30" r="3.5"/><circle cx="57" cy="30" r="3.5"/>
   <circle cx="50" cy="39" r="2.5"/>
   <path d="M46 44 Q50 50 54 44"/>
   <line x1="26" y1="64" x2="10" y2="78"/><line x1="74" y1="64" x2="90" y2="78"/>
   <line x1="38" y1="84" x2="36" y2="100"/><line x1="62" y1="84" x2="64" y2="100"/>
   <path d="M64 84 Q78 92 80 80 Q80 68 68 72"/>`,
  // 9: 닭
  `<ellipse cx="42" cy="62" rx="26" ry="22"/><circle cx="42" cy="34" r="18"/>
   <path d="M36 18 Q32 6 38 4 Q46 2 44 16"/>
   <path d="M44 28 Q52 24 56 18 Q58 28 50 32"/>
   <path d="M34 46 Q26 50 24 45 Q26 40 34 43"/>
   <circle cx="36" cy="29" r="3.5"/><circle cx="48" cy="30" r="3.5"/>
   <path d="M38 42 Q42 46 46 42"/>
   <path d="M68 52 Q84 36 90 44 Q88 56 78 58"/>
   <path d="M68 60 Q86 54 90 64 Q88 74 76 72"/>
   <path d="M68 70 Q84 66 86 78 Q80 88 70 82"/>
   <line x1="36" y1="84" x2="34" y2="100"/><line x1="50" y1="84" x2="52" y2="100"/>`,
  // 10: 개
  `<ellipse cx="50" cy="64" rx="30" ry="22"/><circle cx="50" cy="36" r="22"/>
   <path d="M26 26 Q14 14 18 28 Q22 40 30 32"/><path d="M74 26 Q86 14 82 28 Q78 40 70 32"/>
   <circle cx="42" cy="32" r="3.5"/><circle cx="58" cy="32" r="3.5"/>
   <ellipse cx="50" cy="44" rx="9" ry="6"/>
   <path d="M44 48 Q50 54 56 48"/>
   <line x1="24" y1="42" x2="44" y2="44"/><line x1="24" y1="47" x2="44" y2="46"/>
   <line x1="76" y1="42" x2="56" y2="44"/><line x1="76" y1="47" x2="56" y2="46"/>
   <path d="M80 58 Q92 52 94 44 Q90 40 86 50"/>
   <line x1="36" y1="86" x2="34" y2="100"/><line x1="64" y1="86" x2="66" y2="100"/>`,
  // 11: 돼지
  `<ellipse cx="50" cy="66" rx="35" ry="26"/><circle cx="50" cy="34" r="26"/>
   <circle cx="34" cy="24" r="11"/><circle cx="66" cy="24" r="11"/>
   <ellipse cx="50" cy="48" rx="17" ry="12"/>
   <circle cx="45" cy="48" r="3"/><circle cx="55" cy="48" r="3"/>
   <circle cx="42" cy="28" r="3.5"/><circle cx="58" cy="28" r="3.5"/>
   <path d="M44 42 Q50 46 56 42"/>
   <path d="M85 58 Q96 52 94 66 Q90 78 80 70"/>
   <line x1="34" y1="90" x2="32" y2="100"/><line x1="44" y1="92" x2="42" y2="100"/>
   <line x1="56" y1="92" x2="58" y2="100"/><line x1="66" y1="90" x2="68" y2="100"/>`,
];

function makeSvgUrl(content: string, size: number, sw = 1.5): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" stroke="white" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${content}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function ZodiacBackground({ branch }: { branch: number }) {
  const content = ZODIAC_SVG_PATHS[branch];

  const leftItems = [
    { top:'4%',  size:160, sw:1.4, delay:'0s',   dur:'14s', op:0.14 },
    { top:'28%', size:110, sw:1.7, delay:'2.5s', dur:'10s', op:0.11 },
    { top:'55%', size:180, sw:1.3, delay:'1.2s', dur:'16s', op:0.13 },
    { top:'80%', size:125, sw:1.6, delay:'3.5s', dur:'12s', op:0.10 },
  ];
  const rightItems = [
    { top:'10%', size:145, sw:1.5, delay:'1.5s', dur:'13s', op:0.12 },
    { top:'36%', size:195, sw:1.2, delay:'0.5s', dur:'17s', op:0.09 },
    { top:'62%', size:120, sw:1.8, delay:'2.0s', dur:'12s', op:0.13 },
    { top:'86%', size:165, sw:1.4, delay:'0.8s', dur:'15s', op:0.11 },
  ];

  return (
    <>
      <style>{`
        @keyframes zodiacFloatL {
          0%   { transform: translate(0px, 0px)    rotate(-2deg); }
          20%  { transform: translate(18px, -14px) rotate(2deg);  }
          45%  { transform: translate(32px, -26px) rotate(4deg);  }
          65%  { transform: translate(20px, -16px) rotate(1deg);  }
          80%  { transform: translate(10px, -8px)  rotate(-1deg); }
          100% { transform: translate(0px, 0px)    rotate(-2deg); }
        }
        @keyframes zodiacFloatR {
          0%   { transform: translate(0px, 0px)     rotate(2deg);  }
          20%  { transform: translate(-18px, -14px) rotate(-2deg); }
          45%  { transform: translate(-32px, -26px) rotate(-4deg); }
          65%  { transform: translate(-20px, -16px) rotate(-1deg); }
          80%  { transform: translate(-10px, -8px)  rotate(1deg);  }
          100% { transform: translate(0px, 0px)     rotate(2deg);  }
        }
        @keyframes zodiacAppear {
          from { opacity:0; }
          to   { opacity:1; }
        }
      `}</style>
      <div style={{ position:'fixed', top:0, left:0, width:'11%', height:'100%', pointerEvents:'none', zIndex:0, overflow:'hidden' }}>
        {leftItems.map((item, i) => (
          <img key={i} src={makeSvgUrl(content, item.size, item.sw)} alt="" style={{
            position:'absolute',
            left:`-${Math.round(item.size * 0.45)}px`,
            top: item.top,
            opacity: item.op,
            filter:'drop-shadow(0 0 10px rgba(139,111,198,0.5)) drop-shadow(0 0 24px rgba(139,111,198,0.2))',
            animation:`zodiacFloatL ${item.dur} ease-in-out ${item.delay} infinite, zodiacAppear 2s ease ${item.delay} both`,
          }} />
        ))}
      </div>
      <div style={{ position:'fixed', top:0, right:0, width:'11%', height:'100%', pointerEvents:'none', zIndex:0, overflow:'hidden' }}>
        {rightItems.map((item, i) => (
          <img key={i} src={makeSvgUrl(content, item.size, item.sw)} alt="" style={{
            position:'absolute',
            right:`-${Math.round(item.size * 0.45)}px`,
            top: item.top,
            opacity: item.op,
            filter:'drop-shadow(0 0 10px rgba(232,196,106,0.5)) drop-shadow(0 0 24px rgba(232,196,106,0.2))',
            animation:`zodiacFloatR ${item.dur} ease-in-out ${item.delay} infinite, zodiacAppear 2s ease ${item.delay} both`,
          }} />
        ))}
      </div>
    </>
  );
}

// ─── 오행 레이더 차트 (오각형 SVG) ───
const ELEM_COLORS_VIZ = ['#3db550','#e03030','#d4a800','#c0c0c0','#4488cc'];
const ELEM_LABELS     = ['목(木)','화(火)','토(土)','금(金)','수(水)'];

function OhaengRadar({ counts }: { counts: number[] }) {
  const cx = 80, cy = 80, R = 58, r0 = 10;
  const max = Math.max(...counts, 1);
  const angles = [-90, -18, 54, 126, 198].map(d => d * Math.PI / 180);

  const gridPts = (ratio: number) =>
    angles.map(a => [cx + ratio * R * Math.cos(a), cy + ratio * R * Math.sin(a)] as [number,number]);

  const outerPts = gridPts(1);
  const dataPts  = angles.map((a, i) => {
    const ratio = r0/R + (1 - r0/R) * counts[i] / max;
    return [cx + ratio * R * Math.cos(a), cy + ratio * R * Math.sin(a)] as [number,number];
  });

  const toPath = (pts: [number,number][]) => pts.map((p,i) => `${i===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') + ' Z';

  return (
    <div style={{ textAlign:'center' }}>
      <div style={{ fontSize:'.72rem', color:'var(--muted)', marginBottom:6, fontWeight:700 }}>오행 분포</div>
      <svg width={160} height={160} viewBox="0 0 160 160">
        {/* 그리드 */}
        {[0.25,0.5,0.75,1].map(r => (
          <polygon key={r} points={gridPts(r).map(p=>p.join(',')).join(' ')}
            fill="none" stroke="rgba(255,255,255,.1)" strokeWidth={0.8} />
        ))}
        {outerPts.map((p,i) => (
          <line key={i} x1={cx} y1={cy} x2={p[0]} y2={p[1]}
            stroke="rgba(255,255,255,.1)" strokeWidth={0.8} />
        ))}
        {/* 데이터 영역 */}
        <path d={toPath(dataPts)} fill="rgba(139,111,198,.35)" stroke="#8b6fc6" strokeWidth={1.5} />
        {/* 점 + 값 */}
        {dataPts.map((p,i) => (
          <g key={i}>
            <circle cx={p[0]} cy={p[1]} r={3} fill={ELEM_COLORS_VIZ[i]} />
          </g>
        ))}
        {/* 레이블 */}
        {outerPts.map((_p,i) => {
          const lx = cx + (R+16) * Math.cos(angles[i]);
          const ly = cy + (R+16) * Math.sin(angles[i]);
          return (
            <text key={i} x={lx} y={ly+4} textAnchor="middle"
              fontSize={9} fontWeight={700} fill={counts[i]>0?ELEM_COLORS_VIZ[i]:'rgba(255,255,255,.3)'}>
              {ELEM_LABELS[i].split('(')[0]} {counts[i]}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// ─── AI 풀이 렌더러 ───
function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i} style={{ color:'#ffffff', fontWeight:700 }}>{part.slice(2,-2)}</strong>
      : part
  );
}

// ─── 월별 운세 막대 차트 ───
const LEVEL_COL: Record<string, string> = {
  '매우 좋음': '#4cbe82', '좋음': '#7ac87a',
  '보통': '#8888b0', '주의': '#e8a054', '매우 주의': '#e05555',
};
function MonthlyChart({ briefs }: { briefs: MonthlyBrief[] }) {
  const maxAbs = Math.max(...briefs.map(b => Math.abs(b.score)), 1);
  const now = new Date().getMonth() + 1;
  return (
    <div style={{ margin:'16px 0 4px', padding:'16px 18px',
      background:'rgba(0,0,0,.18)', borderRadius:10, border:'1px solid rgba(255,255,255,.07)' }}>
      <div style={{ fontSize:'.72rem', color:'var(--muted)', marginBottom:12,
        fontWeight:700, letterSpacing:'.06em' }}>📅 월별 운세 흐름</div>
      {briefs.map(b => {
        const pct  = (Math.abs(b.score) / maxAbs) * 100;
        const col  = LEVEL_COL[b.level] ?? '#8888b0';
        const cur  = b.month === now;
        const kw   = b.oneLiner.split('—')[0].split('·')[0].trim();
        return (
          <div key={b.month} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5 }}>
            <div style={{ width:26, fontSize:'.68rem', textAlign:'right', flexShrink:0,
              color: cur ? '#ffffff' : 'var(--muted)', fontWeight: cur ? 800 : 400 }}>
              {b.month}월
            </div>
            <div style={{ flex:1, height:16, background:'rgba(255,255,255,.05)',
              borderRadius:4, overflow:'hidden', position:'relative' }}>
              <div style={{ position:'absolute', left:0, top:0, height:'100%',
                width:`${pct}%`, background:col, borderRadius:4, opacity: b.score < 0 ? 0.55 : 0.9,
                transition:'width .4s' }} />
              {cur && <div style={{ position:'absolute', inset:0, border:`1px solid ${col}`,
                borderRadius:4, boxSizing:'border-box' }} />}
            </div>
            <div style={{ width:90, fontSize:'.68rem', color: col, fontWeight:600,
              flexShrink:0, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
              {kw}
            </div>
          </div>
        );
      })}
      <div style={{ display:'flex', gap:12, marginTop:10, flexWrap:'wrap' }}>
        {Object.entries(LEVEL_COL).map(([lv, c]) => (
          <span key={lv} style={{ fontSize:'.62rem', color:c, display:'flex', alignItems:'center', gap:4 }}>
            <span style={{ width:8, height:8, borderRadius:2, background:c, display:'inline-block' }}/>
            {lv}
          </span>
        ))}
      </div>
    </div>
  );
}

function AiRenderer({ text, loading, result }: {
  text: string; loading: boolean; result?: SajuResult | null;
}) {
  const ds = result?.pillars[2]?.s ?? 0;
  const monthlyBriefs: MonthlyBrief[] | null = useMemo(() => {
    if (!result) return null;
    const dayElem = STEM_ELEM[ds];
    const { isWeak } = calcStrength(result.pillars, dayElem);
    const cls = classifyElements(ds, isWeak, result.ohaeng.counts);
    return buildMonthlyBriefs(result, cls, new Date().getFullYear());
  }, [result, ds]);

  const SECTION_CHART: Record<string, React.ReactNode> = result ? {
    '1': <div key="c1" style={{ margin:'12px 0' }}><SinGangGauge pillars={result.pillars} dayStemIdx={ds} /></div>,
    '4': <div key="c4" style={{ margin:'12px 0', display:'flex', justifyContent:'center' }}><OhaengRadar counts={result.ohaeng.counts} /></div>,
    '9': monthlyBriefs ? <MonthlyChart key="c9" briefs={monthlyBriefs} /> : null,
  } : {};

  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let k = 0;

  for (const line of lines) {
    // [N] 섹션 헤더
    const sec = line.match(/^\[(\d+)\]\s+(.+)/);
    if (sec) {
      nodes.push(
        <div key={k++} style={{ display:'flex', alignItems:'baseline', gap:10, marginTop:28, marginBottom:10 }}>
          <span style={{ background:'rgba(139,111,198,.35)', color:'#d0b8ff', fontWeight:900,
            fontSize:'.72rem', padding:'3px 10px', borderRadius:100, flexShrink:0, lineHeight:1.7,
            letterSpacing:'.04em' }}>
            {sec[1]}
          </span>
          <span style={{ fontWeight:800, fontSize:'1rem', color:'var(--gold)', lineHeight:1.4 }}>
            {renderInline(sec[2])}
          </span>
        </div>
      );
      if (SECTION_CHART[sec[1]]) nodes.push(SECTION_CHART[sec[1]]);
      continue;
    }
    // ━━━ 구분선
    if (/^━{3,}/.test(line)) {
      nodes.push(<div key={k++} style={{ height:1, background:'rgba(255,255,255,.1)', margin:'12px 0' }} />);
      continue;
    }
    // — 불릿
    if (/^[—•]\s/.test(line)) {
      nodes.push(
        <div key={k++} style={{ display:'flex', gap:8, marginBottom:5, paddingLeft:2 }}>
          <span style={{ color:'var(--purple)', flexShrink:0, marginTop:'3px', fontSize:'.8rem' }}>▸</span>
          <span style={{ fontSize:'.9rem', color:'rgba(248,246,255,.92)', lineHeight:1.85 }}>
            {renderInline(line.replace(/^[—•]\s/,''))}
          </span>
        </div>
      );
      continue;
    }
    // 빈 줄
    if (!line.trim()) {
      nodes.push(<div key={k++} style={{ height:6 }} />);
      continue;
    }
    // 일반 텍스트
    nodes.push(
      <p key={k++} style={{ fontSize:'.9rem', color:'rgba(248,246,255,.92)', lineHeight:1.9, marginBottom:3 }}>
        {renderInline(line)}
      </p>
    );
  }

  return (
    <div style={{ marginTop:20, padding:'22px 24px', background:'rgba(0,0,0,.25)',
      borderRadius:12, border:'1px solid rgba(255,255,255,.08)' }}>
      {nodes}
      {loading && <span style={{ color:'var(--purple)', fontWeight:700 }}>▌</span>}
    </div>
  );
}

// ─── 신강/신약 게이지 ───
function SinGangGauge({ pillars, dayStemIdx }: { pillars: (Pillar|null)[], dayStemIdx: number }) {
  const dayElem = STEM_ELEM[dayStemIdx];
  const { score, isWeak } = calcStrength(pillars, dayElem);
  const clamped = Math.max(-6, Math.min(6, score));
  const pct     = ((clamped + 6) / 12) * 100;
  const label   = score <= -3 ? '극신약' : score <= 0 ? '신약' : score <= 3 ? '신강' : '극신강';
  const color   = isWeak ? '#4a9eff' : '#e8c46a';

  return (
    <div style={{ textAlign:'center' }}>
      <div style={{ fontSize:'.72rem', color:'var(--muted)', marginBottom:6, fontWeight:700 }}>일간 강도</div>
      <div style={{ position:'relative', height:12, borderRadius:6, background:'rgba(255,255,255,.08)', overflow:'hidden', margin:'0 auto', width:140 }}>
        <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${pct}%`,
          background:`linear-gradient(90deg,#4a9eff,${color})`, borderRadius:6, transition:'width .6s' }} />
        <div style={{ position:'absolute', left:'50%', top:0, height:'100%', width:1, background:'rgba(255,255,255,.3)' }} />
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', width:140, margin:'4px auto 0', fontSize:'.65rem', color:'var(--muted)' }}>
        <span>신약</span><span>중화</span><span>신강</span>
      </div>
      <div style={{ marginTop:6, fontSize:'.8rem', fontWeight:800, color }}>
        {label} <span style={{ fontSize:'.7rem', fontWeight:400, color:'var(--muted)' }}>({score > 0 ? '+' : ''}{score})</span>
      </div>
    </div>
  );
}

// ─── 십신 관계 그리드 ───
const SIPSIN_COLORS: Record<string,string> = {
  비견:'#4a9eff',겁재:'#7070c0',식신:'#4cbe82',상관:'#2a9060',
  편재:'#e8c46a',정재:'#c09030',편관:'#e05555',정관:'#b03030',
  편인:'#c47bc4',정인:'#8b6fc6',
};

function SipsinGrid({ pillars, dayStemIdx }: { pillars: (Pillar|null)[], dayStemIdx: number }) {
  const labels = ['년','월','일','시'];
  const stems  = ['갑','을','병','정','무','기','경','신','임','계'];

  return (
    <div style={{ textAlign:'center' }}>
      <div style={{ fontSize:'.72rem', color:'var(--muted)', marginBottom:8, fontWeight:700 }}>십신 배치</div>
      <div style={{ display:'flex', gap:6, justifyContent:'center' }}>
        {pillars.map((p, i) => {
          if (!p) return (
            <div key={i} style={{ width:52, padding:'8px 4px', borderRadius:8,
              background:'rgba(255,255,255,.03)', border:'1px solid var(--border)', textAlign:'center' }}>
              <div style={{ fontSize:'.6rem', color:'var(--muted)', marginBottom:4 }}>{labels[i]}주</div>
              <div style={{ fontSize:'.7rem', color:'rgba(255,255,255,.2)' }}>미입력</div>
            </div>
          );
          const ss  = i === 2 ? '일간' : getSipsin(dayStemIdx, p.s);
          const col = i === 2 ? 'var(--gold)' : (SIPSIN_COLORS[ss] || '#888');
          return (
            <div key={i} style={{ width:52, padding:'8px 4px', borderRadius:8,
              background: i===2 ? 'rgba(232,196,106,.07)' : 'rgba(255,255,255,.03)',
              border:`1px solid ${i===2?'rgba(232,196,106,.3)':'var(--border)'}`, textAlign:'center' }}>
              <div style={{ fontSize:'.6rem', color:'var(--muted)', marginBottom:4 }}>{labels[i]}주</div>
              <div style={{ fontSize:'.95rem', fontWeight:900, color:col, marginBottom:3 }}>{stems[p.s]}</div>
              <div style={{ fontSize:'.6rem', padding:'1px 4px', borderRadius:4,
                background:`${col}22`, color:col, display:'inline-block', fontWeight:700 }}>{ss}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
