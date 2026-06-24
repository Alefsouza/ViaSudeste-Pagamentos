import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/hooks/use-auth'
import { extractFieldErrors } from '@/lib/pocketbase/errors'
import { KeyRound, Eye, EyeOff } from 'lucide-react'

export function ChangePasswordModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [oldPassword, setOldPassword] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setErrors({})
    if (password !== passwordConfirm) {
      setErrors({ passwordConfirm: 'As senhas não coincidem.' })
      return
    }

    if (password.length < 8) {
      setErrors({ password: 'A nova senha deve ter no mínimo 8 caracteres.' })
      return
    }

    setLoading(true)
    try {
      await pb.collection('users').update(user.id, {
        oldPassword,
        password,
        passwordConfirm,
      })
      toast({
        title: 'Senha alterada com sucesso!',
        description: 'Sua senha foi atualizada com segurança.',
      })
      onOpenChange(false)
      // reset form
      setOldPassword('')
      setPassword('')
      setPasswordConfirm('')
      setShowPassword(false)
    } catch (err) {
      const fieldErrors = extractFieldErrors(err)
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors)
      } else {
        toast({
          title: 'Erro ao alterar senha',
          description: 'Verifique a senha atual e tente novamente.',
          variant: 'destructive',
        })
      }
    } finally {
      setLoading(false)
    }
  }

  // Handle open change to clear form when closed
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setOldPassword('')
      setPassword('')
      setPasswordConfirm('')
      setErrors({})
      setShowPassword(false)
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-forest/10 dark:bg-forest/20 text-forest dark:text-mint-light shrink-0">
              <KeyRound size={20} />
            </div>
            <div>
              <DialogTitle>Alterar Senha</DialogTitle>
              <DialogDescription>
                Preencha os campos abaixo para atualizar sua senha de acesso.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="oldPassword">Senha Atual</Label>
            <div className="relative">
              <Input
                id="oldPassword"
                type={showPassword ? 'text' : 'password'}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
                className={errors.oldPassword ? 'border-red-500 pr-10' : 'pr-10'}
                placeholder="Sua senha atual"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 focus:outline-none"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.oldPassword && (
              <p className="text-sm text-red-500 font-medium">{errors.oldPassword}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Nova Senha</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={errors.password ? 'border-red-500 pr-10' : 'pr-10'}
                placeholder="Mínimo 8 caracteres"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 focus:outline-none"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && (
              <p className="text-sm text-red-500 font-medium">{errors.password}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="passwordConfirm">Confirmar Nova Senha</Label>
            <div className="relative">
              <Input
                id="passwordConfirm"
                type={showPassword ? 'text' : 'password'}
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                required
                className={errors.passwordConfirm ? 'border-red-500 pr-10' : 'pr-10'}
                placeholder="Repita a nova senha"
              />
            </div>
            {errors.passwordConfirm && (
              <p className="text-sm text-red-500 font-medium">{errors.passwordConfirm}</p>
            )}
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="bg-forest hover:bg-forest/90">
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
