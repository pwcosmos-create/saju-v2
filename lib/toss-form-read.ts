const PENDING_FORM_KEY = 'saju_pending_form';

/** 토스 WebView: React 하이드레이션 전·후 모두 DOM에서 폼 값을 읽는다 */
export type SajuFormDom = {
  year: string;
  month: string;
  day: string;
  hour: string;
  name: string;
  gender: '남' | '여';
  lunar: boolean;
  leapM: boolean;
};

export function readSajuFormFromDom(root: ParentNode = document): SajuFormDom | null {
  const card = root.querySelector('.form-card');
  if (!card) return null;

  const yearEl = card.querySelector<HTMLInputElement>('input[type="number"]');
  const monthEl = card.querySelector<HTMLSelectElement>('select[aria-label="월"]');
  const dayEl = card.querySelector<HTMLSelectElement>('select[aria-label="일"]');
  const hourEl = card.querySelectorAll<HTMLSelectElement>('.form-grid select');
  const hourSelect = hourEl[hourEl.length - 1] ?? null;

  const nameEl = card.querySelector<HTMLInputElement>('input:not([type="number"]):not([type="checkbox"])');

  const genderBtns = [...card.querySelectorAll<HTMLButtonElement>('.form-grid button')].filter((b) =>
    /^(남|여)/.test((b.textContent || '').replace(/\s/g, '')),
  );
  const activeGender = genderBtns.find((b) => {
    const s = b.getAttribute('style') || '';
    return s.includes('var(--purple)') || s.includes('139,111,198') || /purple/i.test(s);
  });
  const gender: '남' | '여' =
    (activeGender?.textContent || '').includes('여') ? '여' : '남';

  const calBtns = [...card.querySelectorAll<HTMLButtonElement>('button')].filter((b) => {
    const t = (b.textContent || '').replace(/\s/g, '');
    return t === '양력' || t === '음력';
  });
  const lunar = calBtns.some((b) => {
    const s = b.getAttribute('style') || '';
    return (b.textContent || '').includes('음력') && (s.includes('var(--purple)') || s.includes('139,111,198') || /purple/i.test(s));
  });
  const leapEl = card.querySelector<HTMLInputElement>('input[type="checkbox"]');

  return {
    year: yearEl?.value ?? '',
    month: monthEl?.value ?? '',
    day: dayEl?.value ?? '',
    hour: hourSelect?.value ?? '-1',
    name: nameEl?.value ?? '',
    gender,
    lunar,
    leapM: leapEl?.checked ?? false,
  };
}

/** 하이드레이션 직전 사용자 입력·이전 계산 폼 복원 */
export function readInitialSajuForm(): SajuFormDom | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(PENDING_FORM_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SajuFormDom;
      if (parsed.year && parsed.month && parsed.day) return parsed;
    }
  } catch {
    /* ignore */
  }
  return readSajuFormFromDom();
}
