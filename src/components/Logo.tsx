import { cn } from '@/lib/utils'

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center max-w-full overflow-hidden', className)}>
      <img
        src="https://img.usecurling.com/i?q=truck&color=azure"
        alt="Via Sudeste Transportes S/A Logo"
        className="h-full w-auto max-w-full object-contain drop-shadow-sm"
        loading="eager"
        decoding="async"
        fetchPriority="high"
      />
    </div>
  )
}
