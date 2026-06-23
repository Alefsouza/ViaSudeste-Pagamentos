import { cn } from '@/lib/utils'

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 320 80"
      className={cn('w-auto object-contain', className)}
      fill="none"
      aria-label="Via Sudeste Logo"
      role="img"
    >
      <defs>
        <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#059669" />
          <stop offset="100%" stop-color="#10b981" />
        </linearGradient>
      </defs>
      <path
        d="M 15 20 L 30 60 L 45 20"
        stroke="url(#logo-gradient)"
        stroke-width="8"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M 45 60 L 60 20 L 75 60"
        stroke="currentColor"
        stroke-width="8"
        stroke-linecap="round"
        stroke-linejoin="round"
        className="text-slate-900 dark:text-white"
      />
      <text
        x="95"
        y="44"
        font-family="system-ui, -apple-system, sans-serif"
        font-size="30"
        font-weight="800"
        fill="currentColor"
        className="text-slate-900 dark:text-white"
      >
        Via Sudeste
      </text>
      <text
        x="97"
        y="62"
        font-family="system-ui, -apple-system, sans-serif"
        font-size="12"
        font-weight="600"
        fill="currentColor"
        className="text-slate-500 dark:text-slate-400"
        letter-spacing="2"
      >
        TRANSPORTES S/A
      </text>
    </svg>
  )
}
