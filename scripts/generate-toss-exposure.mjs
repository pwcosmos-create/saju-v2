/**
 * 앱인토스 콘솔 「노출 정보」용 PNG 생성 (요구 픽셀 그대로).
 * 실행: npm run toss:exposure
 * 산출물: public/toss-exposure/
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'public', 'toss-exposure');

const font =
  "'Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',sans-serif";

/** 라운드 사각형 마스크 + 그라데이션 느낌은 단색+비네트로 단순화 (SVG 그라데이션은 sharp에서도 동작) */
function logoSvg({ dark }) {
  const bg0 = dark ? '#05040f' : '#0d0b1e';
  const bg1 = dark ? '#12102a' : '#1a163a';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bg0}"/>
      <stop offset="100%" stop-color="${bg1}"/>
    </linearGradient>
  </defs>
  <rect width="600" height="600" rx="0" fill="url(#g)"/>
  <g transform="translate(300,300) scale(13.5) translate(-12,-12)">
    <path d="M12 2L13.5 9L21 10.5L13.5 12L12 19L10.5 12L3 10.5L10.5 9L12 2Z" fill="#c4a8ff"/>
    <path d="M18.5 15.5L19.5 18L22 19L19.5 20L18.5 22.5L17.5 20L15 19L17.5 18L18.5 15.5Z" fill="#8b6fc6"/>
    <path d="M5.5 16L6 17.5L7.5 18L6 18.5L5.5 20L5 18.5L3.5 18L5 17.5L5.5 16Z" fill="#8b6fc6"/>
  </g>
</svg>`;
}

function thumbnailSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1932" height="828" viewBox="0 0 1932 828">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0d0b1e"/>
      <stop offset="55%" stop-color="#1a1240"/>
      <stop offset="100%" stop-color="#0f1728"/>
    </linearGradient>
    <radialGradient id="glow" cx="22%" cy="35%" r="55%">
      <stop offset="0%" stop-color="rgba(139,111,198,0.55)"/>
      <stop offset="100%" stop-color="rgba(13,11,30,0)"/>
    </radialGradient>
    <radialGradient id="glow2" cx="78%" cy="70%" r="45%">
      <stop offset="0%" stop-color="rgba(74,158,255,0.22)"/>
      <stop offset="100%" stop-color="rgba(13,11,30,0)"/>
    </radialGradient>
  </defs>
  <rect width="1932" height="828" fill="url(#bg)"/>
  <rect width="1932" height="828" fill="url(#glow)"/>
  <rect width="1932" height="828" fill="url(#glow2)"/>
  <g transform="translate(140,140) scale(5.2) translate(-12,-12)">
    <path d="M12 2L13.5 9L21 10.5L13.5 12L12 19L10.5 12L3 10.5L10.5 9L12 2Z" fill="#ebe4ff"/>
    <path d="M18.5 15.5L19.5 18L22 19L19.5 20L18.5 22.5L17.5 20L15 19L17.5 18L18.5 15.5Z" fill="#c4b5ff"/>
    <path d="M5.5 16L6 17.5L7.5 18L6 18.5L5.5 20L5 18.5L3.5 18L5 17.5L5.5 16Z" fill="#9b82eb"/>
  </g>
  <text x="420" y="340" font-family="${font}" font-size="92" font-weight="900" fill="#f2ecff">AI사주</text>
  <text x="420" y="460" font-family="${font}" font-size="44" font-weight="600" fill="#c4a8ff">생년월일로 보는 60갑자 · 오행 · AI 심층 풀이</text>
  <text x="420" y="540" font-family="${font}" font-size="32" fill="rgba(200,190,255,0.55)">saju.coupax.co.kr</text>
  <rect x="1620" y="320" width="220" height="72" rx="36" fill="#8b6fc6" opacity="0.95"/>
  <text x="1730" y="368" text-anchor="middle" font-family="${font}" font-size="30" font-weight="800" fill="#ffffff">시작</text>
</svg>`;
}

function phoneFrame(w, h, inner) {
  const r = 36;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="#0a0818"/>
  <rect x="28" y="64" width="${w - 56}" height="${h - 128}" rx="${r}" fill="#0d0b1e" stroke="rgba(139,111,198,0.35)" stroke-width="2"/>
  ${inner}
</svg>`;
}

function shotIntro() {
  return phoneFrame(636, 1048, `
  <text x="318" y="220" text-anchor="middle" font-family="${font}" font-size="34" font-weight="800" fill="#e8c97e">✦ 무료 사주팔자</text>
  <text x="318" y="290" text-anchor="middle" font-family="${font}" font-size="26" fill="#b8a8e0">연·월·일·시 60갑자 계산</text>
  <rect x="78" y="380" width="480" height="64" rx="14" fill="rgba(255,255,255,0.06)" stroke="rgba(139,111,198,0.35)"/>
  <text x="100" y="422" font-family="${font}" font-size="22" fill="rgba(255,255,255,0.45)">생년월일 입력…</text>
  <rect x="78" y="480" width="480" height="72" rx="36" fill="#6b46c1"/>
  <text x="318" y="528" text-anchor="middle" font-family="${font}" font-size="24" font-weight="800" fill="#ffffff">분석하기</text>
  `);
}

function shotResult() {
  return phoneFrame(636, 1048, `
  <text x="318" y="200" text-anchor="middle" font-family="${font}" font-size="28" font-weight="800" fill="#e0cfff">사주팔자 요약</text>
  <text x="318" y="260" text-anchor="middle" font-family="${font}" font-size="22" fill="#8b6fc6">甲子 · 丙寅 · 戊午 · 壬子</text>
  <rect x="60" y="320" width="516" height="180" rx="20" fill="rgba(139,111,198,0.12)" stroke="rgba(232,201,126,0.25)"/>
  <text x="88" y="370" font-family="${font}" font-size="20" fill="#e8c97e">오행 균형</text>
  <text x="88" y="410" font-family="${font}" font-size="18" fill="rgba(255,255,255,0.72)">목 2 · 화 3 · 토 1 · 금 1 · 수 1</text>
  <text x="88" y="460" font-family="${font}" font-size="18" fill="rgba(255,255,255,0.55)">대운 · 신살 · AI 심층 풀이 탭</text>
  <rect x="60" y="540" width="516" height="56" rx="12" fill="rgba(74,158,255,0.15)"/>
  <text x="88" y="578" font-family="${font}" font-size="18" fill="#90cdf4">AI 풀이 스트리밍 중…</text>
  `);
}

function shotChat() {
  return phoneFrame(636, 1048, `
  <text x="318" y="200" text-anchor="middle" font-family="${font}" font-size="28" font-weight="800" fill="#e8c97e">AI 심층 상담</text>
  <rect x="60" y="260" width="400" height="120" rx="16" fill="rgba(139,111,198,0.2)"/>
  <text x="88" y="310" font-family="${font}" font-size="19" fill="#e0d8ff">상담사가 사주 맥락을 바탕으로 답해 드려요.</text>
  <rect x="176" y="420" width="400" height="100" rx="16" fill="rgba(255,255,255,0.06)"/>
  <text x="200" y="478" font-family="${font}" font-size="18" fill="rgba(255,255,255,0.75)">텍스트 · 음성으로 질문</text>
  <rect x="60" y="620" width="516" height="64" rx="22" fill="rgba(255,255,255,0.05)" stroke="rgba(139,111,198,0.3)"/>
  <text x="88" y="662" font-family="${font}" font-size="18" fill="rgba(255,255,255,0.4)">메시지를 입력하세요…</text>
  `);
}

function shotHorizontal() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1504" height="741" viewBox="0 0 1504 741">
  <defs>
    <linearGradient id="hb" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0d0b1e"/>
      <stop offset="100%" stop-color="#151030"/>
    </linearGradient>
  </defs>
  <rect width="1504" height="741" fill="url(#hb)"/>
  <g transform="translate(80,120) scale(3.2) translate(-12,-12)">
    <path d="M12 2L13.5 9L21 10.5L13.5 12L12 19L10.5 12L3 10.5L10.5 9L12 2Z" fill="#c4a8ff"/>
    <path d="M18.5 15.5L19.5 18L22 19L19.5 20L18.5 22.5L17.5 20L15 19L17.5 18L18.5 15.5Z" fill="#8b6fc6"/>
  </g>
  <text x="280" y="200" font-family="${font}" font-size="56" font-weight="900" fill="#f2ecff">AI사주</text>
  <text x="280" y="280" font-family="${font}" font-size="28" fill="#b8a8e0">만세력 기반 사주 · AI 심층 풀이 · 상담</text>
  <rect x="280" y="340" width="900" height="280" rx="24" fill="rgba(255,255,255,0.04)" stroke="rgba(139,111,198,0.25)"/>
  <text x="320" y="400" font-family="${font}" font-size="24" fill="#e8c97e">분석 결과 미리보기</text>
  <text x="320" y="450" font-family="${font}" font-size="20" fill="rgba(255,255,255,0.65)">四柱 · 오행 · 대운 · 월별 운세 · AI 스트리밍 풀이</text>
  <text x="320" y="520" font-family="${font}" font-size="20" fill="rgba(255,255,255,0.5)">실제 앱 화면으로 교체해 사용해도 됩니다.</text>
</svg>`;
}

async function svgToPng(svg, filePath) {
  await sharp(Buffer.from(svg, 'utf8')).png({ compressionLevel: 9 }).toFile(filePath);
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });
  const jobs = [
    ['app-logo-600.png', logoSvg({ dark: false })],
    ['app-logo-dark-600.png', logoSvg({ dark: true })],
    ['thumbnail-1932x828.png', thumbnailSvg()],
    ['screenshot-vertical-01.png', shotIntro()],
    ['screenshot-vertical-02.png', shotResult()],
    ['screenshot-vertical-03.png', shotChat()],
    ['screenshot-horizontal-01.png', shotHorizontal()],
  ];
  for (const [name, svg] of jobs) {
    const fp = path.join(outDir, name);
    await svgToPng(svg, fp);
    const meta = await sharp(fp).metadata();
    console.log('wrote', name, `${meta.width}x${meta.height}`);
  }
  console.log('\n폴더:', outDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
