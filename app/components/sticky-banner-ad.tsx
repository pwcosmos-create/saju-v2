"use client";
/**
 * StickyBannerAd
 * 사주 풀이 결과 화면 하단 고정 배너 (TossAds.attachBanner)
 * - 가로: 기기 화면 전폭 (left/right 0, width 100% — 100vw 금지)
 * - 세로: 96px + safe-area-inset-bottom
 * - --saju-sticky-banner-h CSS 변수로 본문 padding 연동
 */
import { useEffect, useRef, useState } from "react";
import {
  attachSajuBanner,
  SAJU_BANNER_AD_GROUP_ID,
  SAJU_BANNER_HEIGHT_PX,
  type BannerUiState,
} from "../../lib/toss-banner-ad";

const IS_PLACEHOLDER = SAJU_BANNER_AD_GROUP_ID.startsWith("PLACEHOLDER");

/** 배너 본체 + 홈 인디케이터/제스처바 */
export const SAJU_BANNER_BOX =
  `calc(${SAJU_BANNER_HEIGHT_PX}px + env(safe-area-inset-bottom, 0px))`;

interface Props {
  /** 풀이 결과가 화면에 표시되면 true */
  visible: boolean;
}

export default function StickyBannerAd({ visible }: Props) {
  const slotRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<BannerUiState>("idle");
  const hide = state === "unsupported" || state === "empty";
  const active = visible && !hide;

  useEffect(() => {
    const root = document.documentElement;
    if (!active) {
      root.style.removeProperty("--saju-sticky-banner-h");
      root.classList.remove("has-saju-sticky-banner");
      if (!visible) setState("idle");
      return;
    }
    root.style.setProperty("--saju-sticky-banner-h", SAJU_BANNER_BOX);
    root.classList.add("has-saju-sticky-banner");
    return () => {
      root.style.removeProperty("--saju-sticky-banner-h");
      root.classList.remove("has-saju-sticky-banner");
    };
  }, [active, visible]);

  useEffect(() => {
    if (!active) return;

    let disposed = false;
    let cleanup: (() => void) | undefined;

    const raf = requestAnimationFrame(() => {
      if (disposed || !slotRef.current) return;
      cleanup = attachSajuBanner(slotRef.current, setState);
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cleanup?.();
    };
  }, [active]);

  if (!active) return null;

  const showPlaceholder = IS_PLACEHOLDER || state !== "ready";

  return (
    <>
      <div className="saju-sticky-banner-spacer" style={{ height: SAJU_BANNER_BOX }} aria-hidden />

      <div
        id="saju-sticky-banner"
        role="complementary"
        aria-label="광고"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          width: "100%",
          height: SAJU_BANNER_BOX,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          boxSizing: "border-box",
          zIndex: 8000,
          backgroundColor: "#0d1b2e",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "stretch",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <div
          ref={slotRef}
          id="saju-banner-ad-container"
          style={{
            width: "100%",
            height: "100%",
            minWidth: 0,
            position: "relative",
          }}
        />

        {showPlaceholder && (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              height: SAJU_BANNER_HEIGHT_PX,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "0 max(16px, env(safe-area-inset-left, 16px)) 0 max(16px, env(safe-area-inset-right, 16px))",
              pointerEvents: "none",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                fontSize: ".6rem",
                color: "rgba(255,255,255,0.25)",
                letterSpacing: ".08em",
                textTransform: "uppercase",
                flexShrink: 0,
              }}
            >
              AD
            </div>
            <div
              style={{
                flex: 1,
                minWidth: 0,
                height: 36,
                borderRadius: 6,
                background: "rgba(255,255,255,0.04)",
                border: "1px dashed rgba(255,255,255,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <span style={{ fontSize: ".72rem", color: "rgba(255,255,255,0.2)" }}>
                {IS_PLACEHOLDER ? "광고 ID 연결 대기 중..." : "광고 불러오는 중..."}
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
