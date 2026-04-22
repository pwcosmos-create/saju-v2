interface RateEntry { count: number; reset: number; }

export function makeRateLimiter(maxCount: number, windowMs: number) {
  const map = new Map<string, RateEntry>();
  return function check(ip: string): boolean {
    const now = Date.now();
    const entry = map.get(ip);
    if (!entry || now > entry.reset) {
      map.set(ip, { count: 1, reset: now + windowMs });
      return true;
    }
    if (entry.count >= maxCount) return false;
    entry.count++;
    return true;
  };
}
