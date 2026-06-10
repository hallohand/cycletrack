import type { Metadata, Viewport } from 'next';
import { Lora, Raleway } from 'next/font/google';
import './globals.css';

// Selbst gehostet via next/font: offline-fähig (PWA), kein Render-Blocking,
// kein Google-Fonts-Host in der CSP.
const lora = Lora({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-lora',
  display: 'swap',
});

const raleway = Raleway({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-raleway',
  display: 'swap',
});
import AppLayout from '@/components/layout/Layout';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { AppLock } from '@/components/guard/AppLock';
import { CycleProvider } from '@/components/CycleContext';
import ErrorBoundary from '@/components/ErrorBoundary';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export const metadata: Metadata = {
  title: 'CycleTrack',
  description: 'Privater Zyklus-Tracker',
  manifest: `${basePath}/manifest.json`,
  icons: {
    icon: `${basePath}/icon-192.png`,
    shortcut: `${basePath}/icon-192.png`,
    apple: `${basePath}/apple-touch-icon.png`,
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

// Next 16: viewport/themeColor live in their own export — inside `metadata`
// they are ignored and only produce build warnings.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#FFF8F9',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: next-themes sets the `class` attribute on
    // <html> before hydration (dark/system theme), which is expected.
    <html lang="de" suppressHydrationWarning className={`${lora.variable} ${raleway.variable}`}>
      <head>
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://generativelanguage.googleapis.com https://api.github.com https://gist.githubusercontent.com; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'self';"
        />
        {/* Service-Worker-Registrierung übernimmt @ducanh2912/next-pwa
            automatisch (inkl. basePath-Scope) — eine zweite, manuelle
            Registrierung würde mit abweichendem Scope konkurrieren. */}
      </head>
      <body className="min-h-dvh overscroll-none font-sans">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <ErrorBoundary>
            <CycleProvider>
              <AppLock>
                <AppLayout>{children}</AppLayout>
              </AppLock>
              <Toaster position="top-center" />
            </CycleProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  );
}
