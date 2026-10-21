import { ImageResponse } from 'next/og';

// ikon PNG buat PWA (Android butuh PNG 192 & 512, iOS 180)
export async function GET(request: Request) {
  const raw = Number(new URL(request.url).searchParams.get('size'));
  const size = [180, 192, 512].includes(raw) ? raw : 192;
  const s = size / 100;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#16181d',
        }}
      >
        {/* plat saklar dengan 4 tombol, sama seperti ikon favicon */}
        <div
          style={{
            width: 58 * s,
            height: 58 * s,
            borderRadius: 12 * s,
            background: '#f5f3ef',
            display: 'flex',
            flexWrap: 'wrap',
            padding: 7 * s,
            gap: 5 * s,
          }}
        >
          {[true, false, false, true].map((on, i) => (
            <div
              key={i}
              style={{
                width: 19.5 * s,
                height: 19.5 * s,
                borderRadius: 5 * s,
                background: on ? '#f2b33d' : '#d9d5cc',
              }}
            />
          ))}
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
