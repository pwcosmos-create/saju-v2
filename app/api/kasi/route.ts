// KASI 공공데이터 API 프록시 — 서버 전용 (API 키 노출 방지)
import { NextRequest } from 'next/server';

const BASE = 'https://apis.data.go.kr/B090041/openapi/service';
const KEY  = () => process.env.KASI_SERVICE_KEY ?? '';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const service = searchParams.get('service');  // 예: LrsrCldInfoService/getLunCalInfo
  if (!service) return Response.json({ error: 'service 파라미터 필요' }, { status: 400 });

  // 허용 서비스 화이트리스트
  const allowed = [
    'LrsrCldInfoService/getLunCalInfo',
    'LrsrCldInfoService/getSolCalInfo',
    'SpcdeInfoService/get24DivisionsInfo',
    'LunPhInfoService/getLunPhInfo',
    'RiseSetInfoService/getAreaRiseSetInfo',
    'SrAltudeInfoService/getAreaSrAltudeInfo',
  ];
  if (!allowed.includes(service)) {
    return Response.json({ error: '허용되지 않은 서비스' }, { status: 403 });
  }

  // 쿼리 파라미터 전달 (service 제외, serviceKey 자동 주입)
  const params = new URLSearchParams({ serviceKey: KEY(), _type: 'json' });
  for (const [k, v] of searchParams.entries()) {
    if (k !== 'service') params.set(k, v);
  }

  try {
    const res  = await fetch(`${BASE}/${service}?${params}`, { next: { revalidate: 3600 } });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
