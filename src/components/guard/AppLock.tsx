'use client';

import { useEffect, useState } from 'react';
import { authenticatePasskey, isAppLockEnabled } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Lock } from 'lucide-react';

export function AppLock({ children }: { children: React.ReactNode }) {
    const [isLocked, setIsLocked] = useState(true); // Default to locked to prevent flash
    const [hasLockConfigured, setHasLockConfigured] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkLock = async () => {
            const enabled = isAppLockEnabled();
            setHasLockConfigured(enabled);

            if (!enabled) {
                setIsLocked(false);
                setIsLoading(false);
                return;
            }

            // Attempt auto-unlock on mount? 
            // Better to show UI first, then let user tap "Unlock" or auto-trigger?
            // Users usually expect auto-trigger.
            setIsLoading(false);
            triggerUnlock();
        };

        checkLock();
    }, []);

    const triggerUnlock = async () => {
        try {
            const success = await authenticatePasskey();
            if (success) {
                setIsLocked(false);
            }
        } catch (e) {
            // User cancelled or failed
        }
    };

    if (isLoading) return null; // Or a splash screen

    if (!hasLockConfigured || !isLocked) {
        return <>{children}</>;
    }

    return (
        <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center space-y-6 p-4">
            <div className="bg-primary/10 p-4 rounded-full">
                <Lock className="w-12 h-12 text-primary" />
            </div>
            <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold">App gesperrt</h1>
                <p className="text-muted-foreground">Bitte authentifizieren, um fortzufahren.</p>
            </div>

            <Button size="lg" onClick={triggerUnlock} className="w-full max-w-xs gap-2">
                <ShieldCheck className="w-5 h-5" />
                Entsperren
            </Button>
        </div>
    );
}
