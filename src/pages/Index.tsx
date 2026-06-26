import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { cn } from '@/lib/utils'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import defaultBg from '@/assets/1-2ad70.jpeg'

export default function Index() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({})

  const { login, signIn, user } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [backgroundUrl, setBackgroundUrl] = useState<string>(defaultBg)

  useEffect(() => {
    const loadBackground = async () => {
      try {
        const record = await pb
          .collection('app_settings')
          .getFirstListItem('name="login_background_new"')
        if (record && record.file) {
          setBackgroundUrl(pb.files.getURL(record, record.file))
        }
      } catch (err) {
        console.error('Failed to load dynamic background:', err)
      }
    }
    loadBackground()
  }, [])

  useRealtime('app_settings', (e) => {
    if (e.record.name === 'login_background_new') {
      if (e.action === 'update' || e.action === 'create') {
        if (e.record.file) {
          setBackgroundUrl(pb.files.getURL(e.record, e.record.file))
        }
      }
    }
  })

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

    if (!email) {
      setErrors((prev) => ({ ...prev, email: 'E-mail é obrigatório' }))
      return
    }
    if (!password) {
      setErrors((prev) => ({ ...prev, password: 'Senha é obrigatória' }))
      return
    }

    setIsLoading(true)
    try {
      const doLogin = login || signIn
      if (!doLogin) throw new Error('Método de login não encontrado')

      const { error } = await doLogin(email, password)
      if (error) {
        setErrors({ form: 'Credenciais inválidas. Verifique seu e-mail e senha.' })
        toast({
          variant: 'destructive',
          title: 'Erro ao fazer login',
          description: 'Credenciais inválidas. Verifique seu e-mail e senha.',
        })
      }
    } catch (err: any) {
      setErrors({ form: 'Ocorreu um erro inesperado. Tente novamente.' })
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Ocorreu um erro inesperado. Tente novamente mais tarde.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className={cn(
        'relative h-dvh w-full flex flex-col overflow-hidden bg-slate-900 bg-cover bg-center bg-no-repeat transition-colors duration-1000',
      )}
      style={{
        backgroundImage: `url('${backgroundUrl}')`,
      }}
    >
      {/* Semi-transparent green overlay */}
      <div className="absolute inset-0 bg-green-950/70 sm:bg-green-900/60 z-10 mix-blend-multiply" />
      <div className="absolute inset-0 bg-black/30 z-10" />

      {/* Content wrapper */}
      <div className="relative z-20 flex-1 flex flex-col justify-between items-center py-6 px-4 sm:px-0 h-full w-full">
        {/* Top spacer to push card to center */}
        <div className="flex-none" />

        {/* Login Content */}
        <div className="w-full max-w-md flex flex-col items-center animate-in slide-in-from-bottom-8 fade-in duration-700">
          {/* Brand Container */}
          <div className="mb-6 sm:mb-8 border border-white/20 shadow-2xl bg-white/10 backdrop-blur-lg p-4 sm:p-5 rounded-2xl shrink-0 flex items-center justify-center">
            <Logo className="h-12 sm:h-16 w-auto" />
          </div>

          {/* Glassmorphism Login Card */}
          <Card className="w-full border border-white/20 shadow-2xl bg-white/10 backdrop-blur-lg shrink-0 rounded-2xl text-white">
            <CardHeader className="space-y-2 pb-6 text-center">
              <CardTitle className="text-2xl font-bold tracking-tight text-white">
                PAGAMENTOS
              </CardTitle>
              <CardDescription className="text-white/80">
                Insira suas credenciais para acessar sua conta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-5">
                {errors.form && (
                  <div className="p-3 text-sm text-red-200 bg-red-950/50 border border-red-500/50 rounded-md text-center font-medium backdrop-blur-sm">
                    {errors.form}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-white/90">
                    E-mail
                  </Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-white/50">
                      <Mail className="h-5 w-5" />
                    </div>
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu.email@viasudeste.com.br"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-12 bg-black/20 border-white/20 text-white placeholder:text-white/50 focus-visible:ring-white/30 focus-visible:border-white/40 transition-colors"
                      autoComplete="email"
                      disabled={isLoading}
                    />
                  </div>
                  {errors.email && <p className="text-sm text-red-300">{errors.email}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-white/90">
                    Senha
                  </Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-white/50">
                      <Lock className="h-5 w-5" />
                    </div>
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 h-12 bg-black/20 border-white/20 text-white placeholder:text-white/50 focus-visible:ring-white/30 focus-visible:border-white/40 transition-colors"
                      autoComplete="current-password"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-white/50 hover:text-white transition-colors"
                      disabled={isLoading}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  <div className="flex justify-end pt-1">
                    <a
                      href="#"
                      className="text-sm text-white/70 hover:text-white transition-colors"
                      onClick={(e) => e.preventDefault()}
                    >
                      Esqueci meu usuário/senha
                    </a>
                  </div>
                  {errors.password && <p className="text-sm text-red-300">{errors.password}</p>}
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 mt-6 text-base font-semibold transition-all bg-[#00C853] hover:bg-[#009624] text-white border-0 shadow-[0_0_15px_rgba(0,200,83,0.3)] hover:shadow-[0_0_20px_rgba(0,200,83,0.5)]"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    'Entrar'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Footer Area */}
        <div className="flex-none flex flex-col items-center justify-end space-y-4 text-center text-sm text-white/70 pb-4 mt-8">
          <p>Uso exclusivo de colaboradores autorizados.</p>
        </div>
      </div>
    </div>
  )
}
