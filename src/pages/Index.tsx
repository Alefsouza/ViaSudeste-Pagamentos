import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { useRealtime } from '@/hooks/use-realtime'
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

  const [bgUrl, setBgUrl] = useState<string>('/login-background.png')

  const { login, user } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  useEffect(() => {
    let mounted = true
    async function fetchBg() {
      try {
        const record = await pb
          .collection('app_settings')
          .getFirstListItem('name="login_background"')
        if (!mounted) return

        if (record.file) {
          const baseUrl = pb.files.getURL(record, record.file)
          const separator = baseUrl.includes('?') ? '&' : '?'
          const cacheBuster = record.updated
            ? `${separator}t=${new Date(record.updated).getTime()}`
            : ''
          setBgUrl(`${baseUrl}${cacheBuster}`)
        } else if (record.value) {
          const separator = record.value.includes('?') ? '&' : '?'
          const cacheBuster = record.updated
            ? `${separator}t=${new Date(record.updated).getTime()}`
            : ''
          setBgUrl(`${record.value}${cacheBuster}`)
        }
      } catch (err) {
        // Fallback to local default image is handled by initial state
      }
    }
    fetchBg()

    return () => {
      mounted = false
    }
  }, [])

  useRealtime('app_settings', (e) => {
    if (e.record.name === 'login_background') {
      if (e.action === 'delete') {
        setBgUrl('/login-background.png')
        return
      }
      const record = e.record
      if (record.file) {
        const baseUrl = pb.files.getURL(record, record.file)
        const separator = baseUrl.includes('?') ? '&' : '?'
        const cacheBuster = record.updated
          ? `${separator}t=${new Date(record.updated).getTime()}`
          : ''
        setBgUrl(`${baseUrl}${cacheBuster}`)
      } else if (record.value) {
        const separator = record.value.includes('?') ? '&' : '?'
        const cacheBuster = record.updated
          ? `${separator}t=${new Date(record.updated).getTime()}`
          : ''
        setBgUrl(`${record.value}${cacheBuster}`)
      } else {
        setBgUrl('/login-background.png')
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
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4 relative overflow-hidden bg-forest">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-transform duration-1000"
        style={{
          backgroundImage: `url('${bgUrl}')`,
        }}
      />
      {/* Green overlay to maintain brand consistency while allowing image visibility */}
      <div className="absolute inset-0 bg-forest/10" />

      <Card className="w-full max-w-[420px] relative z-10 bg-white/10 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] rounded-3xl border border-white/20 animate-slide-up text-white">
        <CardHeader className="space-y-3 text-center pb-8 pt-10">
          <div className="mx-auto h-20 mb-4 bg-white/5 p-3 rounded-2xl backdrop-blur-sm border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)] flex items-center justify-center transition-transform hover:scale-105">
            <Logo className="h-full w-auto drop-shadow-md text-white" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight text-white drop-shadow-md">
            Bem-vindo
          </CardTitle>
          <CardDescription className="text-base text-white/80 font-medium">
            Acesse sua conta para continuar
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-10">
          <form onSubmit={handleSubmit} className="space-y-6">
            {errors.form && (
              <div className="p-3 bg-red-500/20 backdrop-blur-md text-red-50 text-sm rounded-xl border border-red-500/30 shadow-inner">
                {errors.form}
              </div>
            )}
            <div className="space-y-2.5">
              <Label htmlFor="email" className="text-white/90 font-medium ml-1">
                Email
              </Label>
              {isLoading ? (
                <Skeleton className="h-12 w-full bg-white/20 rounded-xl" />
              ) : (
                <div>
                  <div className="relative group">
                    <Mail className="absolute left-3.5 top-3.5 h-5 w-5 text-white/50 group-focus-within:text-white/90 transition-colors" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="nome@empresa.com"
                      className={`h-12 pl-11 bg-white/5 border-white/10 text-white placeholder:text-white/40 focus-visible:ring-1 focus-visible:ring-mint focus-visible:border-mint transition-all rounded-xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] ${errors.email ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }))
                      }}
                      disabled={isLoading}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-sm text-red-300 mt-1.5 ml-1 drop-shadow-sm">
                      {errors.email}
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-2.5">
              <Label htmlFor="password" className="text-white/90 font-medium ml-1">
                Senha
              </Label>
              {isLoading ? (
                <Skeleton className="h-12 w-full bg-white/20 rounded-xl" />
              ) : (
                <div>
                  <div className="relative group">
                    <Lock className="absolute left-3.5 top-3.5 h-5 w-5 text-white/50 group-focus-within:text-white/90 transition-colors" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      className={`h-12 pl-11 pr-11 bg-white/5 border-white/10 text-white placeholder:text-white/40 focus-visible:ring-1 focus-visible:ring-mint focus-visible:border-mint transition-all rounded-xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] ${errors.password ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
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
                      className="absolute right-1 top-1 h-10 w-10 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isLoading}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </Button>
                  </div>
                  {errors.password && (
                    <p className="text-sm text-red-300 mt-1.5 ml-1 drop-shadow-sm">
                      {errors.password}
                    </p>
                  )}
                </div>
              )}
            </div>
            <Button
              type="submit"
              className="w-full h-12 mt-4 bg-mint hover:bg-mint-light text-forest text-base font-bold shadow-[0_4px_14px_0_rgba(76,175,80,0.39)] hover:shadow-[0_6px_20px_rgba(76,175,80,0.23)] hover:-translate-y-[1px] transition-all duration-200 active:scale-[0.98] rounded-xl"
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
