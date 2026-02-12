'use client';
import { useEffect } from 'react';
import { toast } from 'sonner';

declare global {
    interface Window {
        workbox: any;
    }
}

export default function UpdateNotification() {
    useEffect(() => {
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator && window.workbox !== undefined) {
            const wb = window.workbox;

            // Add event listener for when a new service worker has installed but is waiting to activate
            // This happens when the user has the app open and a new version is available
            wb.addEventListener('waiting', () => {
                toast('Ein Update ist verfügbar!', {
                    description: 'Neue Funktionen und Verbesserungen.',
                    action: {
                        label: 'Aktualisieren',
                        onClick: () => {
                            wb.addEventListener('controlling', () => {
                                window.location.reload();
                            });
                            wb.messageSkipWaiting();
                        }
                    },
                    duration: Infinity, // Don't auto-dismiss
                });
            });

            // Register the service worker via workbox
            // Note: next-pwa handles registration automatically, but we might need to hook into it manually
            // strictly speaking if next-pwa is used without 'register: false', it registers its own SW.
            // But we can access the registration via navigator.serviceWorker.ready ideally.
            // However, the `window.workbox` is injected by next-pwa if configured correctly?
            // Actually, next-pwa injects a script that defines window.workbox.
        }
    }, []);

    return null; // This component doesn't render anything itself
}
