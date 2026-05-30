'use client';

import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { appHref } from './app-path';

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  children: ReactNode;
};

/** 토스 WebView: data-saju-go + 명시적 index.html (layout 인라인 스크립트와 함께 동작) */
export function TossNavAnchor({ href, children, style, ...rest }: Props) {
  const resolved = appHref(href);
  return (
    <a
      {...rest}
      href={resolved}
      data-saju-go
      data-saju-href={resolved}
      target="_self"
      style={style}
    >
      {children}
    </a>
  );
}
