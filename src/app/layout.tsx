import type { Metadata, Viewport } from 'next';
import './globals.css';
import PWAInit from '@/components/layout/PWAInit';

export const metadata: Metadata = {
  title: 'ShadowLive',
  description: 'Expérience live privée et exclusive',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ShadowLive',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#080808',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="antialiased overflow-x-hidden">
        <PWAInit />
        {children}
      </body>
    </html>
  );
}
