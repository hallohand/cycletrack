'use client';

import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('skeleton', className)} />;
}

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col items-center gap-6 px-4 pt-4 animate-in fade-in duration-300">
      {/* Cycle Ring */}
      <Skeleton className="w-48 h-48 rounded-full" />
      {/* Status Pill */}
      <Skeleton className="w-48 h-8 rounded-full" />
      {/* AI Summary */}
      <Skeleton className="w-full h-24 rounded-3xl" />
      {/* Stats Row */}
      <div className="flex gap-3 w-full">
        <Skeleton className="flex-1 h-20 rounded-2xl" />
        <Skeleton className="flex-1 h-20 rounded-2xl" />
        <Skeleton className="flex-1 h-20 rounded-2xl" />
      </div>
      {/* CTA */}
      <Skeleton className="w-full h-14 rounded-2xl" />
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-2 pt-2 animate-in fade-in duration-300">
      <Skeleton className="w-40 h-6" />
      <Skeleton className="w-full h-[300px] rounded-2xl" />
      <Skeleton className="w-full h-12 rounded-xl" />
    </div>
  );
}

export function CalendarSkeleton() {
  return (
    <div className="flex flex-col gap-3 px-2 pt-2 animate-in fade-in duration-300">
      <Skeleton className="w-full h-[320px] rounded-2xl" />
      <Skeleton className="w-full h-32 rounded-2xl" />
    </div>
  );
}
