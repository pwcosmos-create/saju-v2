/**
 * AI Saju Feedback API - v2.0.2
 * 
 * - 피드백 데이터를 feedback.jsonl 파일에 익명으로 저장
 * - 오라클 서버 인스턴스 내 로컬 영구 저장 보장
 */
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: '잘못된 요청 형식' }, { status: 400 });
  }

  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const filePath = path.join(process.cwd(), 'feedback.jsonl');
    const logEntry = JSON.stringify({ timestamp: new Date().toISOString(), ...(body as object) }) + '\n';
    
    await fs.appendFile(filePath, logEntry, 'utf-8');
    
    // 개발 환경에서만 로그 출력
    if (process.env.NODE_ENV === 'development') {
      console.log('[feedback] Saved to file:', logEntry.slice(0, 100) + '...');
    }
  } catch (err) {
    console.error('Failed to save feedback:', err);
  }

  return Response.json({ ok: true });
}
