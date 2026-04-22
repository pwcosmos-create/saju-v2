// 외부 API 설정 단일 진실 모듈 — 값은 환경변수에서만 읽음 (서버 전용)

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`환경변수 누락: ${name}`);
  return val;
}

// Gemini 2.5 Flash 직접 호출
export function fetchGroqStream(body: object): Promise<Response> {
  const geminiKey = requireEnv('GOOGLE_AI_API_KEY');
  return fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${geminiKey}` },
    body:    JSON.stringify({ model: 'gemini-2.5-flash', ...body }),
  });
}

export const LLM_CONFIG = {
  gemini: {
    model:  'gemini-2.5-flash',
    url:    'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    apiKey: () => requireEnv('GOOGLE_AI_API_KEY'),
  },
  // 프리미엄 전용 — 무료 채팅에 사용 금지
  claude: {
    model:  'claude-sonnet-4-6',
    url:    'https://api.anthropic.com/v1/messages',
    apiKey: () => requireEnv('ANTHROPIC_API_KEY'),
  },
} as const;

export const KASI_CONFIG = {
  base:       'https://apis.data.go.kr/B090041/openapi/service',
  serviceKey: () => requireEnv('KASI_SERVICE_KEY'),
  services: {
    lunarCalendar:  'LrsrCldInfoService/getLunCalInfo',
    solarCalendar:  'LrsrCldInfoService/getSolCalInfo',
    solarTerms:     'SpcdeInfoService/get24DivisionsInfo',
    moonPhase:      'LunPhInfoService/getLunPhInfo',
    riseSet:        'RiseSetInfoService/getAreaRiseSetInfo',
    solarAltitude:  'SrAltudeInfoService/getAreaSrAltudeInfo',
  },
} as const;
