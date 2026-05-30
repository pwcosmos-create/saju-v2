/** 토스 WebView iframe 응답 → parent.postMessage (인라인 CSP 우회) */
(function () {
  var el = document.getElementById('saju-bridge-data');
  if (!el) return;
  try {
    var payload = JSON.parse(el.textContent || 'null');
    if (!payload) return;
    var msg = { type: 'saju-bridge', payload: payload };
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(msg, '*');
    }
    if (window.top && window.top !== window) {
      window.top.postMessage(msg, '*');
    }
  } catch (e) {
    /* ignore */
  }
})();
