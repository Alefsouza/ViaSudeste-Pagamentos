import { cn } from '@/lib/utils'

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center max-w-full overflow-hidden', className)}>
      <svg
        viewBox="0 0 620 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-auto max-w-full object-contain drop-shadow-sm"
        aria-label="Via Sudeste Transportes S/A Logo"
        role="img"
      >
        <g transform="translate(30, 10)">
          <path
            d="M0 0 L30 90 L60 0 L80 0 L40 110 L20 110 L-20 0 Z"
            className="fill-forest dark:fill-mint-light"
          />
          <path
            d="M45 0 L75 90 L105 0 L125 0 L85 110 L65 110 L25 0 Z"
            className="fill-forest/80 dark:fill-mint-light/80"
          />
        </g>
        <text
          x="170"
          y="65"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize="56"
          fontWeight="800"
          className="fill-slate-900 dark:fill-white"
          letterSpacing="-0.02em"
        >
          VIA SUDESTE
        </text>
        <text
          x="175"
          y="95"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontSize="22"
          fontWeight="700"
          className="fill-slate-600 dark:fill-slate-400"
          letterSpacing="0.25em"
        >
          TRANSPORTES S/A
        </text>
      </svg>
    </div>
  )
}
