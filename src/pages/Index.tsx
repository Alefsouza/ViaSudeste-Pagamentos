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
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center scale-105 transition-transform duration-1000"
        style={{
          backgroundImage: "url('https://img.usecurling.com/p/1920/1080?q=bus&color=black')",
        }}
      />
      {/* Dark green overlay with blur */}
      <div className="absolute inset-0 bg-forest/80 backdrop-blur-[6px]" />

      <Card className="w-full max-w-[450px] relative z-10 bg-white/10 dark:bg-black/20 backdrop-blur-xl shadow-2xl rounded-2xl border-white/20 animate-slide-up text-white">
        <CardHeader className="space-y-2 text-center pb-8">
          <div className="mx-auto h-20 mb-6 bg-white/10 p-3 rounded-2xl backdrop-blur-sm border border-white/20 shadow-inner flex items-center justify-center">
            <Logo className="h-full w-auto drop-shadow-md text-white" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-white drop-shadow-sm">
            Bem-vindo de volta
          </CardTitle>
          <CardDescription className="text-base text-white/80">
            Insira suas credenciais para acessar o sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {errors.form && (
              <div className="p-3 bg-red-500/20 backdrop-blur-sm text-red-50 text-sm rounded-md border border-red-500/30 shadow-inner">
                {errors.form}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/90 font-medium">
                Email
              </Label>
              {isLoading ? (
                <Skeleton className="h-11 w-full bg-white/20" />
              ) : (
                <div>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3.5 h-4 w-4 text-white/60" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="nome@empresa.com"
                      className={`h-11 pl-9 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus-visible:ring-white/50 focus-visible:border-white/50 transition-all ${errors.email ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }))
                      }}
                      disabled={isLoading}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-sm text-red-300 mt-1 drop-shadow-sm">{errors.email}</p>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/90 font-medium">
                Senha
              </Label>
              {isLoading ? (
                <Skeleton className="h-11 w-full bg-white/20" />
              ) : (
                <div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3.5 h-4 w-4 text-white/60" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className={`h-11 pl-9 pr-10 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus-visible:ring-white/50 focus-visible:border-white/50 transition-all ${errors.password ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
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
                      className="absolute right-0 top-0.5 h-10 w-10 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isLoading}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </Button>
                  </div>
                  {errors.password && (
                    <p className="text-sm text-red-300 mt-1 drop-shadow-sm">{errors.password}</p>
                  )}
                </div>
              )}
            </div>
            <Button
              type="submit"
              className="w-full h-11 mt-2 bg-mint hover:bg-mint-light text-forest font-bold shadow-lg hover:shadow-xl transition-all active:scale-[0.98]"
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
