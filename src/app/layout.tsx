import type { Metadata } from 'next';
import './globals.css';
import AppLayout from '@/components/layout/Layout';
import { ThemeProvider } from 'next-themes';

export const metadata: Metadata = {
  title: 'CycleTrack',
  description: 'Privater Zyklus-Tracker',
  manifest: '/cycletrack/manifest.json',
  viewport: {
    width: 'device-width',
    initialScale: 1,
  },
  themeColor: '#FF6B9D',
  icons: {
    icon: '/cycletrack/icon-192.png',
    shortcut: '/cycletrack/icon-192.png',
    apple: '/cycletrack/apple-touch-icon.png',
  },
  applicationName: 'CycleTrack',
  appleWebApp: {
    capable: true,
    title: 'CycleTrack',
    statusBarStyle: 'default',
  },
  formatDetection: {
    telephone: false,
  },
};

import { Toaster } from 'sonner';
import UpdateNotification from '@/components/UpdateNotification';

import { AppLock } from "@/components/guard/AppLock";

import { CycleProvider } from '@/components/CycleContext';
import ErrorBoundary from '@/components/ErrorBoundary';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className="h-[100dvh]">
      <head>
        <meta name="theme-color" content="#FFF8F9" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; connect-src 'self' https://generativelanguage.googleapis.com https://api.github.com; img-src 'self' data:; font-src 'self' https://fonts.gstatic.com;"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/cycletrack/sw.js', { scope: '/cycletrack/' });
                });
              }
            `,
          }}
        />
      </head>
      <body className={"h-full overflow-y-auto overscroll-none touch-pan-x touch-pan-y"}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <ErrorBoundary>
            <CycleProvider>
              <AppLock>
                <AppLayout>{children}</AppLayout>
              </AppLock>
              <Toaster position="top-center" />
              <UpdateNotification />
            </CycleProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  );
}
