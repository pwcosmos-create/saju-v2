import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '사주팔자 무료 분석 | 나의 운명을 읽다',
  description: '생년월일로 사주팔자를 무료 분석. 60갑자 일주, 오행, 신살, 대운, 2026년 운세까지.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link rel="stylesheet" crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
