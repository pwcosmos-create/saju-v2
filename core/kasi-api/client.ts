// 한국천문연구원 공공데이터포털 API 클라이언트
// 서비스키: 환경변수 KASI_SERVICE_KEY (서버 전용)

const BASE = 'https://apis.data.go.kr/B090041/openapi/service';

function key() {
  return process.env.KASI_SERVICE_KEY ?? '';
}

function qs(params: Record<string, string | number>) {
  return Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
}

// ─── 음양력 변환 (LrsrCldInfoService) ───

export interface LunarInfo {
  lunYear: string; lunMonth: string; lunDay: string;
  lunLeapmonth: string; // 'true' | 'false'
  lunNm: string;  // 음력 달 이름
  lunSecha: string; // 간지 연
}

/** 양력 → 음력 변환 */
export async function solarToLunar(year: number, month: number, day: number): Promise<LunarInfo> {
  const url = `${BASE}/LrsrCldInfoService/getLunCalInfo?${qs({
    serviceKey: key(), _type: 'json',
    solYear: year, solMonth: String(month).padStart(2,'0'), solDay: String(day).padStart(2,'0'),
  })}`;
  const res  = await fetch(url);
  const json = await res.json();
  return json.response.body.items.item as LunarInfo;
}

/** 음력 → 양력 변환 */
export async function lunarToSolar(year: number, month: number, day: number, leap = false): Promise<{ solYear:string; solMonth:string; solDay:string }> {
  const url = `${BASE}/LrsrCldInfoService/getSolCalInfo?${qs({
    serviceKey: key(), _type: 'json',
    lunYear: year, lunMonth: String(month).padStart(2,'0'), lunDay: String(day).padStart(2,'0'),
    lunLeapmonth: leap ? 'true' : 'false',
  })}`;
  const res  = await fetch(url);
  const json = await res.json();
  return json.response.body.items.item;
}

// ─── 24절기 (LrsrCldInfoService) ───

export interface SolarTermInfo {
  solTerm: string;     // 절기명
  solTermKo: string;   // 한국어 절기명
  solYear: string; solMonth: string; solDay: string;
}

/** 연도별 24절기 목록 조회 */
export async function getSolarTerms(year: number): Promise<SolarTermInfo[]> {
  const url = `${BASE}/SpcdeInfoService/get24DivisionsInfo?${qs({
    serviceKey: key(), _type: 'json',
    solYear: year, numOfRows: 24, pageNo: 1,
  })}`;
  const res  = await fetch(url, { next: { revalidate: 86400 } }); // 하루 캐시
  const json = await res.json();
  const items = json.response.body.items.item;
  return Array.isArray(items) ? items : [items];
}

// ─── 월령 (LunPhInfoService) ───

export interface MoonPhase {
  lunAge: string;     // 월령 (0~29.5)
  lunAgeNm: string;   // 월령 이름 (초승달 등)
}

export async function getMoonPhase(year: number, month: number, day: number): Promise<MoonPhase> {
  const url = `${BASE}/LunPhInfoService/getLunPhInfo?${qs({
    serviceKey: key(), _type: 'json',
    solYear: year, solMonth: String(month).padStart(2,'0'), solDay: String(day).padStart(2,'0'),
  })}`;
  const res  = await fetch(url);
  const json = await res.json();
  return json.response.body.items.item;
}
