import type { Metadata } from 'next';
import './globals.css';
import AppLayout from '@/components/layout/Layout';

export const metadata: Metadata = {
  title: 'CycleTrack',
  description: 'Privater Zyklus-Tracker',
  manifest: '/manifest.json',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false, // Prevent zooming usually for PWA feel
  },
  themeColor: '#FF6B9D',
  icons: {
    icon: '/icon-192.png',
    shortcut: '/icon-192.png',
    apple: '/apple-touch-icon.png',
  },
};

import { Toaster } from 'sonner';
import UpdateNotification from '@/components/UpdateNotification';

import { AppLock } from "@/components/guard/AppLock";

import { CycleProvider } from '@/components/CycleContext';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className="h-[100dvh]">
      <head>
        <meta name="theme-color" content="#fff1f2" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover" />
      </head>
      <body className={"h-full overflow-y-auto overscroll-none touch-pan-x touch-pan-y"}>
        <CycleProvider>
          <AppLock>
            <AppLayout>{children}</AppLayout>
          </AppLock>
          <Toaster />
          <UpdateNotification />
        </CycleProvider>
      </body>
    </html>
  );
}
