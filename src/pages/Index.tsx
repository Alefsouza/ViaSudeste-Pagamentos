import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, Role } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { Eye, EyeOff, Loader2, Lock, Mail, UserCircle2 } from 'lucide-react'

export default function Index() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<Role>('gestor')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

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

    setIsLoading(true)
    try {
      await login(email, role)
      toast({ title: 'Sucesso', description: `Bem-vindo de volta, ${email.split('@')[0]}!` })
      navigate(role === 'gestor' ? '/dashboard' : '/camera')
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
          <div className="mx-auto bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full w-16 h-16 flex items-center justify-center mb-2">
            <Lock className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
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
                    className="pl-9 focus-visible:ring-blue-500"
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
                    className="pl-9 pr-10 focus-visible:ring-blue-500"
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
            <div className="space-y-2">
              <Label htmlFor="role">Tipo de usuário</Label>
              {isLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select
                  value={role}
                  onValueChange={(val: Role) => setRole(val)}
                  disabled={isLoading}
                >
                  <SelectTrigger className="w-full focus:ring-blue-500">
                    <div className="flex items-center gap-2">
                      <UserCircle2 className="h-4 w-4 text-slate-400" />
                      <SelectValue placeholder="Selecione o perfil" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gestor">Gestor</SelectItem>
                    <SelectItem value="caixa">Boca de Caixa</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <Button
              type="submit"
              className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white transition-all active:scale-[0.98]"
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
