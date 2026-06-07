'use client';

import { useEffect } from 'react';
import { preloadSajuRewardedAd } from '../lib/toss-rewarded-ad';

/** 토스 WebView — 앱 진입 직후 광고 preload (분석·AI 풀이 탭 시 즉시 노출) */
export default function TossAdPreload() {
  useEffect(() => {
    preloadSajuRewardedAd();
  }, []);
  return null;
}
