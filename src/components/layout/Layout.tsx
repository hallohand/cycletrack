'use client';
import Link from 'next/link';
import { Home, Plus, Calendar, BarChart2, Settings, List } from 'lucide-react';
import { usePathname } from 'next/navigation';
import PageTransition from './PageTransition';
import { ReactNode } from 'react';
import { EntryDrawer } from '@/components/entry/EntryDrawer';
import { Button } from '@/components/ui/button';

const NavItem = ({ href, icon: Icon, label, isActive }: { href: string; icon: any; label: string; isActive: boolean }) => (
    <Link href={href} className="flex flex-col items-center justify-center w-full h-full space-y-1 relative">
        <div className={`p-2 rounded-xl transition-all duration-300 ${isActive ? 'bg-primary text-primary-foreground scale-110 shadow-lg shadow-primary/20' : 'text-muted-foreground hover:bg-muted'}`}>
            <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
        </div>
        {/* <span className={`text-[10px] font-medium transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>{label}</span> */}

    </Link>
);

export default function Layout({ children }: { children: ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="min-h-screen bg-background pb-28 md:pb-0 md:pl-20">
            {/* Header (Mobile Only) */}
            <header className="bg-background/80 backdrop-blur-md border-b sticky top-0 z-40 px-6 py-4 flex justify-between items-center md:hidden">
                <div>
                    <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-rose-400 bg-clip-text text-transparent">CycleTrack</h1>
                    <p className="text-xs text-muted-foreground font-medium">
                        {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                </div>
                <Link href="/settings">
                    <Button variant="ghost" size="icon" className="rounded-full">
                        <Settings className="w-5 h-5 text-muted-foreground" />
                    </Button>
                </Link>
            </header>

            {/* Main Content */}
            <main className="container max-w-md mx-auto p-4 md:max-w-4xl md:p-8">
                <PageTransition>{children}</PageTransition>
            </main>

            {/* Bottom Dock (Mobile) */}
            <nav className="fixed bottom-6 left-4 right-4 bg-white/90 backdrop-blur-xl border border-white/20 shadow-2xl rounded-2xl h-16 flex items-center justify-around px-2 z-50 md:hidden ring-1 ring-black/5">
                <NavItem href="/" icon={Home} label="Home" isActive={pathname === '/'} />
                <NavItem href="/calendar" icon={Calendar} label="Kalender" isActive={pathname === '/calendar'} />

                {/* Center Action Button (Triggers Drawer) */}
                <div className="-mt-8">
                    <EntryDrawer>
                        <button className="h-14 w-14 bg-gradient-to-br from-primary to-rose-400 rounded-full shadow-lg shadow-primary/40 flex items-center justify-center text-white active:scale-95 transition-transform ring-4 ring-background">
                            <Plus size={28} strokeWidth={2.5} />
                        </button>
                    </EntryDrawer>
                </div>

                <NavItem href="/chart" icon={BarChart2} label="Kurve" isActive={pathname === '/chart'} />
                <NavItem href="/history" icon={List} label="Verlauf" isActive={pathname === '/history'} />
            </nav>

            {/* Destkop Sidebar (Optional implementation for future) */}
            <div className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-20 border-r bg-muted/30 items-center py-8 gap-4">
                <div className="font-bold text-primary mb-4">CT</div>
                {/* Desktop Nav Items... */}
            </div>
        </div>
    );
}
