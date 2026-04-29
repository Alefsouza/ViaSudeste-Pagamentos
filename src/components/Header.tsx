import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LogOut, LayoutDashboard, Camera } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  if (!user) return null

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-xl text-slate-900 dark:text-white">
          <div className="bg-blue-600 p-2 rounded-lg text-white shadow-sm">
            {user.role === 'gestor' ? <LayoutDashboard size={20} /> : <Camera size={20} />}
          </div>
          VarejoPro
        </div>

        <div className="flex items-center gap-4">
          <Badge
            variant="outline"
            className="border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 px-3 py-1 text-sm font-medium shadow-sm"
          >
            {user.role === 'gestor' ? 'Gestor' : 'Boca de Caixa'}
          </Badge>
          <div className="text-sm font-medium text-slate-600 dark:text-slate-300 hidden md:block">
            {user.name}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
            title="Sair"
          >
            <LogOut size={20} />
          </Button>
        </div>
      </div>
    </header>
  )
}
