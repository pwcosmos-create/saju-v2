import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI사주 — 토스 앱에서 열기',
  description: '토스 앱에서 AI사주 미니앱을 실행합니다.',
  robots: { index: false, follow: false },
};

export default function AppSajuLayout({ children }: { children: React.ReactNode }) {
  return children;
}
