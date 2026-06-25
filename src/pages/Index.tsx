import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { Logo } from '@/components/Logo'

export default function Index() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({})

  const { login, user } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  useEffect(() => {
    if (user) {
      navigate(
        user.role === 'Administrador' ? '/dashboard' : user.role === 'DP' ? '/dp/fotos' : '/camera',
      )
    }
  }, [user, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    const newErrors: { email?: string; password?: string } = {}

    if (!email) {
      newErrors.email = 'O email é obrigatório.'
    } else if (!/^\S+@\S+\.\S+$/.test(email)) {
      newErrors.email = 'Por favor, insira um endereço de email válido.'
    }

    if (!password) {
      newErrors.password = 'A senha é obrigatória.'
    } else if (password.length < 8) {
      newErrors.password = 'A senha deve ter no mínimo 8 caracteres.'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setIsLoading(true)

    const { error } = await login(email, password)

    if (error) {
      const err = error as any
      if (err?.status === 400) {
        setErrors({
          form: 'Email ou senha incorretos. Verifique suas credenciais e tente novamente.',
        })
      } else if (err?.status === 0 || err?.isAbort) {
        setErrors({
          form: 'Erro de conexão. Verifique sua internet e tente novamente.',
        })
      } else if (err?.message) {
        setErrors({
          form: `Erro ao fazer login: ${err.message}`,
        })
      } else {
        setErrors({
          form: 'Ocorreu um erro inesperado. Tente novamente.',
        })
      }
      setIsLoading(false)
      return
    }

    const role = pb.authStore.record?.tipo_usuario
    const garagem = pb.authStore.record?.garagem
    toast({
      title: 'Sucesso',
      description: `Bem-vindo de volta, ${email.split('@')[0]}!${garagem ? ` (${garagem})` : ''}`,
    })
    setIsLoading(false)
    navigate(role === 'Administrador' ? '/dashboard' : role === 'DP' ? '/dp/fotos' : '/camera')
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <Card className="w-full max-w-[450px] shadow-xl rounded-2xl border-slate-200 dark:border-slate-800 animate-slide-up">
        <CardHeader className="space-y-2 text-center pb-8">
          <Logo className="mx-auto h-16 sm:h-20 mb-6" />
          <CardTitle className="text-2xl font-bold tracking-tight">Bem-vindo de volta</CardTitle>
          <CardDescription className="text-base">
            Insira suas credenciais para acessar o sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {errors.form && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-md border border-red-200">
                {errors.form}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              {isLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <div>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="nome@empresa.com"
                      className={`pl-9 focus-visible:ring-forest ${errors.email ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }))
                      }}
                      disabled={isLoading}
                    />
                  </div>
                  {errors.email && <p className="text-sm text-red-500 mt-1">{errors.email}</p>}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              {isLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className={`pl-9 pr-10 focus-visible:ring-forest ${errors.password ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }))
                      }}
                      disabled={isLoading}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-10 w-10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isLoading}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </Button>
                  </div>
                  {errors.password && (
                    <p className="text-sm text-red-500 mt-1">{errors.password}</p>
                  )}
                </div>
              )}
            </div>
            <Button
              type="submit"
              className="w-full h-11 bg-forest hover:bg-forest/90 text-white transition-all active:scale-[0.98]"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Autenticando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
