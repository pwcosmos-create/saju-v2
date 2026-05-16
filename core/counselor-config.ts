/**
 * 심층 상담 배정 상담사 — 클라이언트·채팅 API·TTS 에서 동일 목록 사용
 */

export const COUNSELOR_NAMES = ['도화', '현월', '지안', '서윤', '유진'] as const;
export type CounselorName = (typeof COUNSELOR_NAMES)[number];

export const COUNSELOR_ALLOWLIST = new Set<string>(COUNSELOR_NAMES);

/** 이름에 맞춘 성별(브라우저 내장 음성 후보 필터링용) */
export const COUNSELOR_BROWSER_VOICE_GENDER: Record<CounselorName, 'female' | 'male'> = {
  도화: 'female',
  현월: 'female',
  지안: 'male',
  서윤: 'female',
  유진: 'male',
};

/** Gemini 2.5 Flash TTS prebuiltVoiceConfig.voiceName — 상담사별 고정 */
export const COUNSELOR_GEMINI_TTS_VOICE: Record<CounselorName, string> = {
  도화: 'Kore',
  현월: 'Aoede',
  지안: 'Puck',
  서윤: 'Zephyr',
  유진: 'Charon',
};

/** 궁합·관계 상담만 — 차분하고 부드러운 톤용 Gemini 보이스 */
export const COUNSELOR_GEMINI_TTS_VOICE_COMPATIBILITY: Record<CounselorName, string> = {
  도화: 'Laomedeia',
  현월: 'Vindemiatrix',
  지안: 'Enceladus',
  서윤: 'Sulafat',
  유진: 'Orus',
};

/** 공식 보이스 목록(주입 방지 검증용) — Gemini-TTS 문서 기준 */
export const GEMINI_TTS_VOICES_ALL = new Set([
  'Achird',
  'Algenib',
  'Algieba',
  'Alnilam',
  'Charon',
  'Enceladus',
  'Fenrir',
  'Iapetus',
  'Orus',
  'Puck',
  'Rasalgethi',
  'Sadachbia',
  'Sadaltager',
  'Schedar',
  'Umbriel',
  'Zubenelgenubi',
  'Achernar',
  'Aoede',
  'Autonoe',
  'Callirrhoe',
  'Despina',
  'Erinome',
  'Gacrux',
  'Kore',
  'Laomedeia',
  'Leda',
  'Pulcherrima',
  'Sulafat',
  'Vindemiatrix',
  'Zephyr',
]);

export function resolveGeminiTtsVoiceForCounselor(
  rawName: string,
  context: 'single' | 'compatibility' = 'single',
): string {
  const name = rawName.trim();
  if (!COUNSELOR_ALLOWLIST.has(name)) return 'Kore';

  const cn = name as CounselorName;
  if (context === 'compatibility') {
    const compat = COUNSELOR_GEMINI_TTS_VOICE_COMPATIBILITY[cn];
    if (compat && GEMINI_TTS_VOICES_ALL.has(compat)) return compat;
  }
  const mapped = COUNSELOR_GEMINI_TTS_VOICE[cn];
  if (mapped && GEMINI_TTS_VOICES_ALL.has(mapped)) return mapped;
  return 'Kore';
}
