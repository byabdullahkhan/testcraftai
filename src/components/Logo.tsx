import React, { useId } from 'react';

interface LogoProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
  textClassName?: string;
}

const sizeMap = {
  xs: { box: 'w-6 h-6', icon: 'w-6 h-6', text: 'text-base' },
  sm: { box: 'w-8 h-8', icon: 'w-8 h-8', text: 'text-lg' },
  md: { box: 'w-10 h-10', icon: 'w-10 h-10', text: 'text-xl' },
  lg: { box: 'w-14 h-14', icon: 'w-14 h-14', text: 'text-2xl' },
  xl: { box: 'w-20 h-20', icon: 'w-20 h-20', text: 'text-3xl' },
};

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  showText = false,
  className = '',
  textClassName = '',
}) => {
  const uid = useId().replace(/:/g, '');
  const currentSize = sizeMap[size];

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Precision Vector Emblem */}
      <div className={`relative ${currentSize.box} shrink-0 transition-transform group-hover:scale-105 duration-200`}>
        <svg
          viewBox="0 0 120 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-label="TestCraft AI Logo"
          className="w-full h-full drop-shadow-sm"
        >
          <title>TestCraft AI</title>
          <defs>
            <linearGradient id={`logo-bg-${uid}`} x1="10" y1="10" x2="110" y2="110" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#4f46e5" />
              <stop offset="50%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#7c3aed" />
            </linearGradient>

            <linearGradient id={`logo-fold-${uid}`} x1="30" y1="20" x2="90" y2="90" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#e0e7ff" stopOpacity="0.85" />
            </linearGradient>

            <linearGradient id={`logo-accent-${uid}`} x1="20" y1="20" x2="100" y2="100" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
          </defs>

          {/* Rounded Hex Base */}
          <rect x="8" y="8" width="104" height="104" rx="28" fill={`url(#logo-bg-${uid})`} />
          <rect x="9" y="9" width="102" height="102" rx="27" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.25" />

          {/* Stylized Craft 'T' Block */}
          <path
            d="M34 38 C34 33.58 37.58 30 42 30 L78 30 C82.42 30 86 33.58 86 38 L86 42 C86 44.2 84.2 46 82 46 L67 46 L67 80 C67 84.42 63.42 88 59 88 L55 88 C50.58 88 47 84.42 47 80 L47 46 L38 46 C35.8 46 34 44.2 34 42 Z"
            fill={`url(#logo-fold-${uid})`}
          />

          {/* Glowing AI Checkmark */}
          <path
            d="M48 64 L58 74 L88 44"
            fill="none"
            stroke={`url(#logo-accent-${uid})`}
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* AI Spark */}
          <path
            d="M84 22 C84 26 88 28 88 28 C88 28 84 30 84 34 C84 30 80 28 80 28 C80 28 84 26 84 22 Z"
            fill="#38bdf8"
          />
          <circle cx="84" cy="28" r="1.5" fill="#ffffff" />
        </svg>
      </div>

      {showText && (
        <span className={`font-black tracking-tight font-display text-slate-900 ${currentSize.text} ${textClassName}`}>
          TestCraft <span className="text-indigo-600">AI</span>
        </span>
      )}
    </div>
  );
};
