import type { MetadataRoute } from 'next';

const SITE_URL = 'https://saju.coupax.co.kr';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: SITE_URL,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
  ];
}
