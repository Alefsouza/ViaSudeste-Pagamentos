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

export default function Index() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [bgLoaded, setBgLoaded] = useState(true)
  const [bgUrl, setBgUrl] = useState('/background-bus.png')
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({})

  const { login, signIn, user } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  useEffect(() => {
    if (user) {
      navigate(
        user.role === 'Administrador' ? '/dashboard' : user.role === 'DP' ? '/dp/fotos' : '/camera',
      )
    }
  }, [user, navigate])

  const loadBackground = async () => {
    try {
      const record = await pb.collection('app_settings').getFirstListItem('name="login_background"')
      if (record && record.file) {
        const url = pb.files.getURL(record, record.file)
        const img = new Image()
        img.src = url
        img.onload = () => {
          setBgUrl(url)
          setBgLoaded(true)
        }
        img.onerror = () => {
          setBgUrl('/background-bus.png')
          setBgLoaded(true)
        }
      } else {
        setBgUrl('/background-bus.png')
        setBgLoaded(true)
      }
    } catch (e) {
      setBgUrl('/background-bus.png')
      setBgLoaded(true)
    }
  }

  useRealtime('app_settings', (e) => {
    if (e.record.name === 'login_background') {
      loadBackground()
    }
  })

  useEffect(() => {
    loadBackground()
  }, [])

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
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-slate-900">
      {/* Background Image */}
      <div
        className={cn(
          'absolute inset-0 bg-cover bg-center bg-no-repeat z-0 transition-opacity duration-1000',
          bgLoaded ? 'opacity-100' : 'opacity-0',
        )}
        style={{
          backgroundImage: bgUrl ? `url('${bgUrl}')` : undefined,
        }}
      />

      {/* Visual Overlay */}
      <div className="absolute inset-0 bg-slate-900/40 sm:bg-slate-950/60 z-10 backdrop-blur-[2px]" />

      {/* Login Content */}
      <div className="relative z-20 w-full max-w-md px-4 sm:px-0 flex flex-col items-center animate-in slide-in-from-bottom-8 fade-in duration-700">
        {/* Brand Container */}
        <div className="mb-8 bg-white p-5 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.3)] border border-white/20">
          <Logo className="h-16 sm:h-20 w-auto" />
        </div>

        {/* Login Card */}
        <Card className="w-full border-0 shadow-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
          <CardHeader className="space-y-2 pb-6 text-center">
            <CardTitle className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Bem-vindo ao Sistema
            </CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400">
              Insira suas credenciais para acessar sua conta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {errors.form && (
                <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950/50 dark:text-red-400 rounded-md text-center font-medium">
                  {errors.form}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700 dark:text-slate-300">
                  E-mail
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                    <Mail className="h-5 w-5" />
                  </div>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu.email@viasudeste.com.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12 bg-white dark:bg-slate-950"
                    autoComplete="email"
                    disabled={isLoading}
                  />
                </div>
                {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-700 dark:text-slate-300">
                  Senha
                </Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                    <Lock className="h-5 w-5" />
                  </div>
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-12 bg-white dark:bg-slate-950"
                    autoComplete="current-password"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.password && <p className="text-sm text-red-500">{errors.password}</p>}
              </div>

              <Button
                type="submit"
                className="w-full h-12 mt-6 text-base font-semibold transition-all"
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
    </div>
  )
}
