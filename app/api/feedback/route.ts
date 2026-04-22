import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: '잘못된 요청 형식' }, { status: 400 });
  }

  // 개발 환경에서만 로그 출력
  if (process.env.NODE_ENV === 'development') {
    console.log('[feedback]', JSON.stringify(body).slice(0, 200));
  }

  return Response.json({ ok: true });
}
