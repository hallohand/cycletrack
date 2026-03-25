'use client';

interface BlobProps {
  variant?: 'hero' | 'corner' | 'accent';
  className?: string;
  color?: string;
}

export function Blob({ variant = 'hero', className = '', color }: BlobProps) {
  if (variant === 'hero') {
    return (
      <svg
        viewBox="0 0 200 200"
        className={`absolute pointer-events-none opacity-30 ${className}`}
        aria-hidden="true"
      >
        <path
          d="M44.7,-76.4C58.8,-69.2,71.8,-58.1,79.6,-44.2C87.4,-30.2,90,-13.4,88.1,2.6C86.2,18.7,79.8,34,69.8,46.3C59.8,58.6,46.2,67.9,31.4,74.4C16.6,80.9,0.6,84.6,-15.2,82.8C-31,81,-46.6,73.7,-58.8,62.4C-71,51.1,-79.8,35.8,-83.7,19.2C-87.6,2.6,-86.6,-15.4,-80.2,-30.8C-73.8,-46.2,-62,-59,-47.8,-66.1C-33.6,-73.3,-16.8,-74.8,-0.3,-74.3C16.2,-73.8,30.5,-83.5,44.7,-76.4Z"
          transform="translate(100 100)"
          fill={color || 'var(--phase-period)'}
        />
      </svg>
    );
  }

  if (variant === 'corner') {
    return (
      <svg
        viewBox="0 0 200 200"
        className={`absolute pointer-events-none opacity-20 ${className}`}
        aria-hidden="true"
      >
        <path
          d="M39.5,-65.3C50.9,-59.5,59.5,-48.1,67.3,-35.5C75.1,-22.9,82.1,-9.2,81.6,4.1C81.1,17.4,73.1,30.3,63.1,40.5C53.1,50.7,41.1,58.2,28,63.2C14.9,68.2,0.7,70.8,-14.2,70.1C-29.1,69.4,-44.7,65.4,-55.2,56C-65.7,46.6,-71.1,31.8,-74.8,16.2C-78.5,0.6,-80.5,-15.8,-75.4,-29.4C-70.3,-43,-58.1,-53.8,-44.5,-58.8C-30.9,-63.8,-15.5,-62.9,-0.5,-62C14.4,-61.2,28.1,-71.1,39.5,-65.3Z"
          transform="translate(100 100)"
          fill={color || 'var(--phase-luteal)'}
        />
      </svg>
    );
  }

  // accent
  return (
    <svg
      viewBox="0 0 200 200"
      className={`absolute pointer-events-none opacity-25 ${className}`}
      aria-hidden="true"
    >
      <path
        d="M47.7,-73.5C60.3,-67.9,67.8,-52.1,73.5,-36.3C79.2,-20.5,83.2,-4.6,80.6,9.8C78,24.2,68.8,37.1,57.7,47.3C46.6,57.5,33.6,65,19.3,70.1C5,75.2,-10.6,77.9,-24.6,74.1C-38.6,70.3,-51,60,-60,47.3C-69,34.6,-74.6,19.5,-76,3.6C-77.4,-12.3,-74.6,-29,-65.8,-41.5C-57,-54,-42.2,-62.3,-27.6,-66.8C-13,-71.3,1.4,-72,15.8,-72.1C30.2,-72.2,35.1,-79.1,47.7,-73.5Z"
        transform="translate(100 100)"
        fill={color || 'var(--phase-fertile)'}
      />
    </svg>
  );
}

export function CycleRing({
  day,
  totalDays,
  phase,
  size = 192,
}: {
  day: number;
  totalDays: number;
  phase: string;
  size?: number;
}) {
  const progress = Math.min(day / totalDays, 1);
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  // Phase color segments
  const periodEnd = 0.18; // ~5/28
  const fertileStart = 0.32;
  const fertileEnd = 0.54;
  const ovuPoint = 0.5;

  const getPhaseColor = (t: number) => {
    if (t < periodEnd) return 'var(--phase-period)';
    if (t < fertileStart) return 'var(--phase-luteal)';
    if (t < fertileEnd) return 'var(--phase-fertile)';
    if (t < fertileEnd + 0.04) return 'var(--phase-ovulation)';
    return 'var(--phase-luteal)';
  };

  const phaseLabel: Record<string, string> = {
    'MENSTRUATION': 'Periode',
    'PRE_FERTILE': 'Follikelphase',
    'FERTILE_MID': 'Fruchtbar',
    'PEAK_LH': 'Hochfruchtbar',
    'POST_OVU_PENDING': 'Eisprung möglich',
    'OVU_CONFIRMED': 'Lutealphase',
    'ANOVULATORY_SUSPECTED': 'Unklar',
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Progress gradient — using conic gradient via multiple segments */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
          style={{
            filter: 'drop-shadow(0 0 6px rgba(232, 102, 139, 0.3))',
          }}
        />
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-serif font-bold text-foreground leading-none">
          {day}
        </span>
        <span className="text-xs text-muted-foreground mt-1">
          {phaseLabel[phase] || phase}
        </span>
      </div>
    </div>
  );
}
