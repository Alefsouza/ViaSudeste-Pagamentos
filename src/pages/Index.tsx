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
import logoImg from '@/assets/sem-nome-190-50-px-4ee9e.png'

export default function Index() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

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
    if (!email || !password) {
      toast({
        title: 'Erro de validação',
        description: 'Preencha todos os campos.',
        variant: 'destructive',
      })
      return
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast({
        title: 'Email inválido',
        description: 'Por favor, insira um endereço de email válido.',
        variant: 'destructive',
      })
      return
    }

    if (password.length < 8) {
      toast({
        title: 'Senha muito curta',
        description: 'A senha deve ter no mínimo 8 caracteres.',
        variant: 'destructive',
      })
      return
    }

    setIsLoading(true)
    try {
      await login(email, password)
      const role = pb.authStore.record?.tipo_usuario
      toast({ title: 'Sucesso', description: `Bem-vindo de volta, ${email.split('@')[0]}!` })
      navigate(role === 'Administrador' ? '/dashboard' : role === 'DP' ? '/dp/fotos' : '/camera')
    } catch {
      toast({
        title: 'Erro ao fazer login',
        description: 'Email ou senha incorretos.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <Card className="w-full max-w-[450px] shadow-xl rounded-2xl border-slate-200 dark:border-slate-800 animate-slide-up">
        <CardHeader className="space-y-2 text-center pb-8">
          <img
            src={logoImg}
            alt="Via Sudeste"
            className="mx-auto h-[50px] w-auto object-contain mb-4"
          />
          <CardTitle className="text-2xl font-bold tracking-tight">Bem-vindo de volta</CardTitle>
          <CardDescription className="text-base">
            Insira suas credenciais para acessar o sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              {isLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="nome@empresa.com"
                    className="pl-9 focus-visible:ring-forest"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              {isLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="pl-9 pr-10 focus-visible:ring-forest"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
