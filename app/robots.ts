import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/'],
      },
    ],
    sitemap: 'https://saju.coupax.co.kr/sitemap.xml',
    host: 'https://saju.coupax.co.kr',
  };
}
