import { cn } from '@/lib/utils'

export function Logo({ className }: { className?: string }) {
  return (
    <img
      src="/logo.png"
      alt="Via Sudeste Transportes S/A Logo"
      className={cn('w-auto object-contain', className)}
    />
  )
}
