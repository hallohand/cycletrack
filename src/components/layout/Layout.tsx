'use client';
import Link from 'next/link';
import { Home, Plus, Calendar, BarChart2, Settings, List, Sparkles, LucideIcon, Sun, Moon } from 'lucide-react';
import { usePathname } from 'next/navigation';
import PageTransition from './PageTransition';
import { ReactNode, useState, useEffect } from 'react';
import { EntryDrawer } from '@/components/entry/EntryDrawer';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import { motion } from 'framer-motion';

const NavItem = ({ href, icon: Icon, label, isActive }: { href: string; icon: LucideIcon; label: string; isActive: boolean }) => (
    <Link href={href} aria-label={label} className="flex flex-col items-center justify-center w-full h-full relative">
        <div className="relative p-2 rounded-xl transition-colors duration-200">
            {isActive && (
                <motion.div
                    layoutId="nav-indicator"
                    className="absolute inset-0 bg-primary rounded-xl"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
            )}
            <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} className={`relative z-10 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
        </div>
        <span className={`text-[10px] font-medium transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>{label}</span>
    </Link>
);

import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';

export default function Layout({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const { theme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    return (
        <div className="min-h-screen bg-background pb-28 md:pb-0 md:pl-20">
            {/* Header (Mobile Only) */}
            <header className="bg-background/95 backdrop-blur-md border-b sticky top-0 z-40 px-6 py-3 flex justify-between items-center md:hidden">
                <h1 className="text-xl font-bold font-serif text-primary">CycleTrack</h1>
                <div className="flex items-center gap-1">
                    {mounted && (
                        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Darstellung wechseln"
                            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                            {theme === 'dark' ? <Sun className="w-5 h-5 text-muted-foreground" /> : <Moon className="w-5 h-5 text-muted-foreground" />}
                        </Button>
                    )}
                    <Link href="/assistant">
                        <Button aria-label="KI-Assistent" variant="ghost" size="icon" className={`rounded-full ${pathname === '/assistant' ? 'text-primary' : ''}`}>
                            <Sparkles className="w-5 h-5" />
                        </Button>
                    </Link>
                    <Link href="/settings">
                        <Button aria-label="Einstellungen" variant="ghost" size="icon" className="rounded-full">
                            <Settings className="w-5 h-5 text-muted-foreground" />
                        </Button>
                    </Link>
                </div>
            </header>

            {/* Main Content */}
            <main className="container max-w-md mx-auto p-4 md:max-w-4xl md:p-8">
                <PageTransition>{children}</PageTransition>
            </main>

            {/* Bottom Dock (Mobile) */}
            <nav className="fixed bottom-6 left-4 right-4 bg-card/95 backdrop-blur-xl border border-border/30 shadow-soft-lg rounded-3xl h-16 flex items-center justify-around px-2 z-50 md:hidden">
                <NavItem href="/" icon={Home} label="Home" isActive={pathname === '/'} />
                <NavItem href="/calendar" icon={Calendar} label="Kalender" isActive={pathname === '/calendar'} />

                {/* Center Action Button (Triggers Drawer) */}
                <div className="-mt-8">
                    <EntryDrawer>
                        <button aria-label="Neuer Eintrag" className="h-14 w-14 bg-primary rounded-full shadow-soft-lg shadow-primary/30 flex items-center justify-center text-white active:scale-95 transition-transform ring-4 ring-card">
                            <Plus size={28} strokeWidth={2.5} />
                        </button>
                    </EntryDrawer>
                </div>

                <NavItem href="/chart" icon={BarChart2} label="Kurve" isActive={pathname === '/chart'} />
                <NavItem href="/history" icon={List} label="Verlauf" isActive={pathname === '/history'} />
            </nav>

            {/* Desktop Sidebar */}
            <div className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-20 bg-card border-r border-border/50 items-center py-8 gap-6">
                <div className="font-serif font-bold text-primary text-lg mb-4">CT</div>
                <NavItem href="/" icon={Home} label="Home" isActive={pathname === '/'} />
                <NavItem href="/calendar" icon={Calendar} label="Kalender" isActive={pathname === '/calendar'} />
                <NavItem href="/chart" icon={BarChart2} label="Kurve" isActive={pathname === '/chart'} />
                <NavItem href="/history" icon={List} label="Verlauf" isActive={pathname === '/history'} />
                <div className="mt-auto flex flex-col items-center gap-4">
                    <NavItem href="/assistant" icon={Sparkles} label="Clara" isActive={pathname === '/assistant'} />
                    <NavItem href="/settings" icon={Settings} label="Settings" isActive={pathname === '/settings'} />
                </div>
            </div>

            <OnboardingWizard />
        </div>
    );
}
