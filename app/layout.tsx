import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: { default: 'Smart Switch', template: '%s · Smart Switch' },
  description: 'Kontrol relay 4 channel ESP32 dari HP: timer, jadwal, skenario, dan pemakaian listrik.',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Smart Switch' },
  icons: { apple: '/api/pwa-icon?size=180' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f3ef' },
    { media: '(prefers-color-scheme: dark)', color: '#16181d' },
  ],
};

// pasang class .dark sebelum paint, biar nggak kedip putih
const themeScript = `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-dvh font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
