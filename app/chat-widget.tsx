'use client';
import { useState, useRef, useEffect } from 'react';

// 한자·괄호 한자 제거 — TTS 전용
function stripHanja(text: string): string {
  return text
    .replace(/\([^)]*[\u4E00-\u9FFF\u3400-\u4DBF][^)]*\)/g, '') // (한자) 괄호째 제거
    .replace(/[\u4E00-\u9FFF\u3400-\u4DBF]/g, '')                // 남은 한자 제거
    .replace(/\s{2,}/g, ' ')                                      // 공백 정리
    .trim();
}
import type { SajuResult } from '../core/pillar-calc/main-calculator';
import {
  STEMS, BRANCHES, STEMS_H, BRANCHES_H,
  STEM_ELEM, BRANCH_ELEM, ELEM_NAMES,
} from '../core/pillar-calc/korean-calendar-engine';
import { classifyElements } from '../core/daily-fortune/classifier';

const GENERATES = [1, 2, 3, 4, 0];

function buildChatContext(r: SajuResult): string {
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

async function streamChat(
  messages: { role: string; content: string }[],
  sajuContext: string,
  onChunk: (t: string) => void,
  onDone: () => void,
  onError: (e: string) => void,
) {
  try {
    const base = process.env.NEXT_PUBLIC_API_BASE ?? '';
    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, sajuContext }),
    });
    if (!res.ok || !res.body) { onError('연결 실패'); return; }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of dec.decode(value, { stream: true }).split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') { onDone(); return; }
        try {
          const text = JSON.parse(raw).choices?.[0]?.delta?.content;
          if (text) onChunk(text);
        } catch { /* skip */ }
      }
    }
    onDone();
  } catch (e) {
    onError(String(e));
  }
}

interface Msg { role: 'user' | 'assistant'; content: string; }

export default function ChatWidget({ result }: { result: SajuResult | null }) {
  const [open, setOpen]       = useState(false);
  const [msgs, setMsgs]       = useState<Msg[]>([]);
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recogRef  = useRef<any>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs]);

  useEffect(() => {
    if (open && msgs.length === 0) {
      setMsgs([{
        role: 'assistant',
        content: result
          ? `안녕하세요! 사주 AI 상담사입니다.\n${result.input.year}년생 ${result.input.gender}성분의 사주를 분석했습니다.\n궁금하신 점을 무엇이든 물어보세요. 🎯`
          : '안녕하세요! 먼저 위에서 사주 분석을 완료해주세요.',
      }]);
    }
  }, [open, result]);

  async function send(text: string = input) {
    const trimmed = text.trim();
    if (!trimmed || loading || !result) return;
    const userMsg: Msg = { role: 'user', content: trimmed };
    const newMsgs = [...msgs, userMsg];
    setMsgs([...newMsgs, { role: 'assistant', content: '' }]);
    setInput('');
    setLoading(true);

    const sajuContext = buildChatContext(result);
    let aiContent = '';

    await streamChat(
      newMsgs.map(m => ({ role: m.role, content: m.content })),
      sajuContext,
      (chunk) => {
        aiContent += chunk;
        setMsgs(prev => {
          const u = [...prev];
          u[u.length - 1] = { role: 'assistant', content: aiContent };
          return u;
        });
      },
      () => {
        setLoading(false);
        if (typeof window !== 'undefined' && window.speechSynthesis && aiContent) {
          window.speechSynthesis.cancel();
          const ttsText = stripHanja(aiContent).slice(0, 600); // 최대 3분 분량
          const utt = new SpeechSynthesisUtterance(ttsText);
          utt.lang = 'ko-KR'; utt.rate = 1.05;
          window.speechSynthesis.speak(utt);
        }
      },
      (err) => {
        setMsgs(prev => {
          const u = [...prev];
          u[u.length - 1] = { role: 'assistant', content: `오류가 발생했습니다: ${err}` };
          return u;
        });
        setLoading(false);
      },
    );
  }

  function toggleVoice() {
    if (typeof window === 'undefined') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) { alert('이 브라우저는 음성 인식을 지원하지 않습니다. (Chrome 권장)'); return; }
    if (listening) { recogRef.current?.stop(); setListening(false); return; }
    const recog = new SR();
    recog.lang = 'ko-KR'; recog.continuous = false; recog.interimResults = false;
    recog.onresult = (e: any) => {
      const t = e.results[0][0].transcript;
      setListening(false);
      send(t);
    };
    recog.onerror = () => setListening(false);
    recog.onend   = () => setListening(false);
    recogRef.current = recog;
    recog.start();
    setListening(true);
  }

  function stopTTS() {
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
  }

  return (
    <>
      {/* Chat Panel */}
      <div style={{
        position: 'fixed', bottom: open ? 0 : '-75vh', right: 0, left: 0,
        maxWidth: 480, margin: '0 auto', height: '72vh',
        background: '#0d0b1e', border: '1px solid rgba(255,255,255,.12)',
        borderBottom: 'none', borderRadius: '20px 20px 0 0',
        display: 'flex', flexDirection: 'column',
        transition: 'bottom .3s ease', zIndex: 1000, overflow: 'hidden',
        boxShadow: '0 -8px 32px rgba(0,0,0,.5)',
      }}>
        {/* Header */}
        <div style={{
          padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,.1)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'rgba(255,255,255,.04)',
        }}>
          <div>
            <div style={{ fontWeight: 700, color: '#e8c97e', fontSize: '.95rem' }}>☯ 사주 AI 상담</div>
            <div style={{ fontSize: '.72rem', color: 'rgba(255,255,255,.45)' }}>궁금한 점을 자유롭게 질문하세요</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={stopTTS} title="음성 중지" style={{
              background: 'none', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8,
              color: 'rgba(255,255,255,.5)', fontSize: '.8rem', cursor: 'pointer', padding: '4px 8px',
            }}>🔇</button>
            <button onClick={() => setOpen(false)} style={{
              background: 'none', border: 'none', color: 'rgba(255,255,255,.5)',
              fontSize: '1.2rem', cursor: 'pointer', padding: '4px 8px',
            }}>✕</button>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {msgs.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '82%', padding: '10px 14px',
                borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: m.role === 'user' ? 'rgba(232,201,126,.15)' : 'rgba(255,255,255,.07)',
                border: `1px solid ${m.role === 'user' ? 'rgba(232,201,126,.3)' : 'rgba(255,255,255,.1)'}`,
                color: '#e0e0e0', fontSize: '.87rem', lineHeight: 1.65, whiteSpace: 'pre-wrap',
              }}>
                {m.content || (loading && i === msgs.length - 1 ? '▌' : '')}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,.08)',
          display: 'flex', gap: 7, background: 'rgba(255,255,255,.02)',
        }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder={result ? '질문을 입력하세요...' : '사주 분석 먼저 해주세요'}
            disabled={loading || !result}
            style={{
              flex: 1, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)',
              borderRadius: 10, padding: '9px 12px', color: '#e8e8e8', fontSize: '.87rem', outline: 'none',
            }}
          />
          <button onClick={toggleVoice} title={listening ? '녹음 중지' : '음성 입력'} style={{
            padding: '9px 11px',
            background: listening ? 'rgba(220,50,50,.25)' : 'rgba(255,255,255,.06)',
            border: `1px solid ${listening ? 'rgba(220,80,80,.5)' : 'rgba(255,255,255,.12)'}`,
            borderRadius: 10, color: listening ? '#ff6b6b' : 'rgba(255,255,255,.55)',
            cursor: 'pointer', fontSize: '1rem', animation: listening ? 'pulse 1s infinite' : 'none',
          }}>🎤</button>
          <button onClick={() => send()} disabled={loading || !input.trim() || !result} style={{
            padding: '9px 14px',
            background: 'rgba(232,201,126,.18)', border: '1px solid rgba(232,201,126,.3)',
            borderRadius: 10, color: '#e8c97e', cursor: 'pointer', fontWeight: 700, fontSize: '.87rem',
            opacity: loading || !input.trim() || !result ? 0.45 : 1,
          }}>전송</button>
        </div>
      </div>

      {/* Floating Button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: 24, right: 20,
          width: 54, height: 54, borderRadius: '50%',
          background: 'linear-gradient(135deg, #e8c97e, #c9a84c)',
          border: 'none', boxShadow: '0 4px 20px rgba(232,201,126,.45)',
          cursor: 'pointer', fontSize: '1.4rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 999,
        }}
        title="사주 AI 상담"
      >
        {open ? '✕' : '☯'}
      </button>
    </>
  );
}
