'use client';

import type { ReactNode } from 'react';

/** 상담 말풍선 — ◆ 소제목 · — 불릿 · 문단 구분 */
export function renderCounselContent(text: string): ReactNode[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const nodes: ReactNode[] = [];
  let k = 0;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      nodes.push(<div key={k++} style={{ height: 8 }} />);
      continue;
    }

    if (line.startsWith('◆')) {
      const title = line.replace(/^◆\s*/, '').trim();
      nodes.push(
        <div
          key={k++}
          style={{ marginTop: nodes.length ? 14 : 4, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          <span
            style={{
              width: 3,
              height: 14,
              background: '#e8c97e',
              borderRadius: 2,
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: '.84rem', fontWeight: 800, color: '#e8c97e' }}>{title}</span>
        </div>,
      );
      continue;
    }

    if (/^\*\*(.+)\*\*$/.test(line.trim())) {
      const m = line.trim().match(/^\*\*(.+)\*\*$/);
      nodes.push(
        <div key={k++} style={{ marginTop: 12, marginBottom: 4, fontSize: '.8rem', fontWeight: 800, color: '#c4b5fd' }}>
          {m?.[1]}
        </div>,
      );
      continue;
    }

    if (/^[—•▸\-]\s/.test(line.trim())) {
      const body = line.trim().replace(/^[—•▸\-]\s*/, '');
      nodes.push(
        <div key={k++} style={{ display: 'flex', gap: 8, marginBottom: 6, paddingLeft: 4 }}>
          <span style={{ color: '#8b6fc6', flexShrink: 0, fontSize: '.75rem', marginTop: 3 }}>▸</span>
          <span style={{ fontSize: '.86rem', lineHeight: 1.75, color: 'rgba(248,246,255,.92)' }}>{inlineMd(body)}</span>
        </div>,
      );
      continue;
    }

    nodes.push(
      <p key={k++} style={{ fontSize: '.86rem', lineHeight: 1.75, margin: '0 0 6px', color: 'rgba(248,246,255,.9)' }}>
        {inlineMd(line.trim())}
      </p>,
    );
  }

  return nodes;
}

function inlineMd(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} style={{ color: '#f0e6ff', fontWeight: 700 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}
