import { ImageResponse } from 'next/og';

export const dynamic = 'force-static';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0d0b1e, #1a163a)',
          borderRadius: '22%',
        }}
      >
        <svg width="320" height="320" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2L13.5 9L21 10.5L13.5 12L12 19L10.5 12L3 10.5L10.5 9L12 2Z" fill="#c4a8ff"/>
          <path d="M18.5 15.5L19.5 18L22 19L19.5 20L18.5 22.5L17.5 20L15 19L17.5 18L18.5 15.5Z" fill="#8b6fc6"/>
          <path d="M5.5 16L6 17.5L7.5 18L6 18.5L5.5 20L5 18.5L3.5 18L5 17.5L5.5 16Z" fill="#8b6fc6"/>
        </svg>
      </div>
    ),
    { ...size }
  );
}
