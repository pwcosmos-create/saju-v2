'use client';
/**
 * useTts — 브라우저 Web Speech, 문장·단락마다 끊어 읽기
 */
import { useState, useRef, useCallback } from 'react';
import { stripHanjaForTts } from '../../lib/strip-hanja-for-tts';
import { primeBrowserTtsVoices, speakPausedBrowserReading } from '../../lib/browser-tts-voice';

/** 문장 사이 쉼 (ms) */
const PAUSE_BETWEEN_SENTENCES_MS = 650;
/** 단락 사이 쉼 (ms) */
const PAUSE_BETWEEN_PARAGRAPHS_MS = 1100;
/** 한 utterance 상한 — 넘으면 쉼표 등으로 추가 분할 */
const SENTENCE_HARD_MAX = 200;

type ReadUnit = { text: string; pauseAfterMs: number };

function cleanForTts(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .trim();
}

function splitLongClause(sentence: string): string[] {
  if (sentence.length <= SENTENCE_HARD_MAX) return [sentence];
  const clauses = sentence.split(/(?<=[,，、])\s*/).map((c) => c.trim()).filter(Boolean);
  if (clauses.length <= 1) return [sentence];
  const out: string[] = [];
  let cur = '';
  for (const c of clauses) {
    if ((cur ? `${cur} ${c}` : c).length > SENTENCE_HARD_MAX && cur) {
      out.push(cur.trim());
      cur = c;
    } else {
      cur = cur ? `${cur} ${c}` : c;
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out.length ? out : [sentence];
}

function splitForPausedReading(text: string): ReadUnit[] {
  const cleaned = cleanForTts(text);
  if (!cleaned) return [];

  const paragraphs = cleaned.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const units: ReadUnit[] = [];

  for (let pi = 0; pi < paragraphs.length; pi++) {
    const para = paragraphs[pi].replace(/\n+/g, ' ');
    const rawSentences = para
      .split(/(?<=[.!?。！？…])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const sentences = (rawSentences.length ? rawSentences : [para]).flatMap(splitLongClause);

    for (let si = 0; si < sentences.length; si++) {
      const isLastInPara = si === sentences.length - 1;
      const isLastOverall = pi === paragraphs.length - 1 && isLastInPara;
      units.push({
        text: sentences[si],
        pauseAfterMs: isLastOverall
          ? 0
          : isLastInPara
            ? PAUSE_BETWEEN_PARAGRAPHS_MS
            : PAUSE_BETWEEN_SENTENCES_MS,
      });
    }
  }

  return units;
}

export function useTts(counselor: string) {
  const [playing, setPlaying] = useState(false);
  const [enabled, setEnabled] = useState(true);

  const abortRef = useRef<AbortController | null>(null);
  const counselorRef = useRef(counselor);
  counselorRef.current = counselor;

  const primeAudio = useCallback(async () => {
    primeBrowserTtsVoices();
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setPlaying(false);
  }, []);

  const speak = useCallback(async (text: string) => {
    const ttsText = stripHanjaForTts(text);
    if (!enabled || !ttsText) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    stop();

    const units = splitForPausedReading(ttsText);
    if (units.length === 0) return;

    const ac = new AbortController();
    abortRef.current = ac;
    setPlaying(true);

    try {
      await speakPausedBrowserReading(units, counselorRef.current, ac.signal);
    } finally {
      if (!ac.signal.aborted) setPlaying(false);
    }
  }, [enabled, stop]);

  return { playing, enabled, setEnabled, speak, stop, primeAudio };
}
