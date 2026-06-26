import { cn } from '@/lib/utils'

export function Logo({
  className,
  variant = 'default',
}: {
  className?: string
  variant?: 'default' | 'header'
}) {
  if (variant === 'header') {
    return (
      <div className={cn('flex items-center justify-center max-w-full overflow-hidden', className)}>
        <img
          src="/visual-edits/sem-nome-190-50-px-610b0304.png"
          alt="Via Sudeste Transportes S/A Logo"
          className="h-full w-auto max-w-full object-contain drop-shadow-sm text-center"
        />
      </div>
    )
  }

  return (
    <div className={cn('flex items-center justify-center max-w-full overflow-hidden', className)}>
      <img
        src="/visual-edits/logo-branco-transparente-nitido-80a6a-biucr1yd-6064e5c7.png"
        alt="Via Sudeste Transportes S/A Logo"
        className="h-full w-auto max-w-full object-contain dark:hidden drop-shadow-sm text-center"
      />
      <img
        src="/logo-dark.svg"
        alt="Via Sudeste Transportes S/A Logo"
        className="h-full w-auto max-w-full object-contain hidden dark:block drop-shadow-sm"
      />
    </div>
  )
}
