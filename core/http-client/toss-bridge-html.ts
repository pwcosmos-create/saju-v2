/** 토스 WebView: iframe POST 응답 → parent.postMessage */
export function tossBridgeHtml(payload: unknown, status = 200): Response {
  const safe = JSON.stringify(payload)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"></head><body><script type="application/json" id="saju-bridge-data">${safe}</script><script src="/toss-bridge.js"></script></body></html>`;
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Content-Security-Policy': 'frame-ancestors *',
    },
  });
}
