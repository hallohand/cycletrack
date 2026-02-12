import { ReactNode } from 'react';

interface StatusCardProps {
    label: string;
    value: string | number;
    hint?: string;
    className?: string; // Additional classes for styling (e.g. urgent/highlight borders)
    children?: ReactNode;
    icon?: ReactNode;
}

export function StatusCard({ label, value, hint, className = "", children, icon }: StatusCardProps) {
    return (
        <div className={`bg-white rounded-2xl p-4 shadow-sm text-center transition-transform active:scale-95 border-2 border-transparent ${className}`}>
            {icon && <div className="text-4xl mb-2 flex justify-center">{icon}</div>}
            <div className="text-xs uppercase tracking-wider text-gray-500 mb-2 font-medium">{label}</div>
            <div className="text-2xl font-bold text-gray-900">{value}</div>
            {hint && <div className="text-xs text-gray-400 mt-1">{hint}</div>}
            {children}
        </div>
    );
}
