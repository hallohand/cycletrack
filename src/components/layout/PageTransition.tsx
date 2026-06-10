'use client';
import { m } from 'framer-motion';
import { usePathname } from 'next/navigation';

// Seitenwechsel passieren oft — die Transition ist subtil und schnell
// (Opacity + minimales Y, ease-out, < 250ms). Reduced Motion übernimmt
// MotionConfig reducedMotion="user" im Layout (neutralisiert die Bewegung,
// behält den Fade) — ein bedingter Early-Return würde dagegen Server- und
// Client-Markup auseinanderlaufen lassen (Hydration-Mismatch).
export default function PageTransition({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <m.div
            key={pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
        >
            {children}
        </m.div>
    );
}
