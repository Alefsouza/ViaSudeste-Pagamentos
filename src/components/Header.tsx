import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  LogOut,
  LayoutDashboard,
  Camera,
  FileText,
  Upload,
  FileSpreadsheet,
  Users,
  Camera as CameraIcon,
  FileDown,
  KeyRound,
  ChevronDown,
  User as UserIcon,
} from 'lucide-react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { ImportPlanilhaModal } from '@/components/ImportPlanilhaModal'
import { UploadFotosModal } from '@/components/UploadFotosModal'
import { ExportFolhaModal } from '@/components/ExportFolhaModal'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ChangePasswordModal } from '@/components/ChangePasswordModal'
import { ProfilePhotoModal } from '@/components/ProfilePhotoModal'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Logo } from '@/components/Logo'

export function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [exportFolhaModalOpen, setExportFolhaModalOpen] = useState(false)
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false)
  const [profilePhotoModalOpen, setProfilePhotoModalOpen] = useState(false)

  if (!user) return null

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-4 md:gap-8">
          <div className="flex items-center">
            <Link
              to={
                user.role === 'Administrador'
                  ? '/dashboard'
                  : user.role === 'DP'
                    ? '/dp/fotos'
                    : '/camera'
              }
              className="hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest rounded-sm"
              aria-label="Ir para a página inicial"
            >
              <Logo className="h-10 sm:h-12 shrink-0" />
            </Link>
          </div>

          {user.role === 'Administrador' ? (
            <nav className="flex items-center gap-3 md:gap-4 text-sm font-medium">
              <Link
                to="/dashboard"
                className={`flex items-center gap-1.5 transition-colors ${
                  location.pathname === '/dashboard'
                    ? 'text-forest dark:text-mint-light'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <LayoutDashboard size={16} />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
              <Link
                to="/relatorio"
                className={`flex items-center gap-1.5 transition-colors ${
                  location.pathname === '/relatorio'
                    ? 'text-forest dark:text-mint-light'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <FileText size={16} />
                <span className="hidden sm:inline">Relatórios</span>
              </Link>
              <button
                onClick={() => setImportModalOpen(true)}
                className="flex items-center gap-1.5 transition-colors text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                <FileSpreadsheet size={16} />
                <span className="hidden sm:inline">Importar Excel</span>
              </button>
              <button
                onClick={() => setExportFolhaModalOpen(true)}
                className="flex items-center gap-1.5 transition-colors text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                <FileDown size={16} />
                <span className="hidden sm:inline">Exportar Folha</span>
              </button>
              <Link
                to="/camera"
                className={`flex items-center gap-1.5 transition-colors ${
                  location.pathname === '/camera'
                    ? 'text-forest dark:text-mint-light'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <Camera size={16} />
                <span className="hidden sm:inline">Pagamentos</span>
              </Link>
              {user.email === 'ti@viasudeste.com' && (
                <>
                  <button
                    onClick={() => setUploadModalOpen(true)}
                    className="flex items-center gap-1.5 transition-colors text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  >
                    <Upload size={16} />
                    <span className="hidden sm:inline">Upload Fotos</span>
                  </button>
                  <Link
                    to="/usuarios"
                    className={`flex items-center gap-1.5 transition-colors ${
                      location.pathname === '/usuarios'
                        ? 'text-forest dark:text-mint-light'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    <Users size={16} />
                    <span className="hidden sm:inline">Usuários</span>
                  </Link>
                </>
              )}
            </nav>
          ) : user.role === 'DP' ? (
            <nav className="flex items-center gap-3 md:gap-4 text-sm font-medium">
              <span className="flex items-center gap-1.5 text-forest dark:text-mint-light font-semibold">
                <CameraIcon size={16} />
                <span className="hidden sm:inline">Captura de Fotos (DP)</span>
              </span>
            </nav>
          ) : (
            <nav className="flex items-center gap-3 md:gap-4 text-sm font-medium">
              <Link
                to="/camera"
                className={`flex items-center gap-1.5 transition-colors ${
                  location.pathname === '/camera'
                    ? 'text-forest dark:text-mint-light'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <Camera size={16} />
                <span className="hidden sm:inline">Pagamentos</span>
              </Link>
              <Link
                to="/relatorio-recebedoria"
                className={`flex items-center gap-1.5 transition-colors ${
                  location.pathname === '/relatorio-recebedoria'
                    ? 'text-forest dark:text-mint-light'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                <FileText size={16} />
                <span className="hidden sm:inline">Relatórios</span>
              </Link>
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3 md:gap-4">
          <Badge
            variant="outline"
            className="border-forest text-forest bg-forest/10 dark:bg-forest/20 px-3 py-1 text-sm font-medium shadow-sm"
          >
            {user.role === 'Administrador'
              ? 'Administrador'
              : user.role === 'DP'
                ? 'DP'
                : 'Recebedoria'}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors outline-none focus-visible:ring-2 focus-visible:ring-forest rounded-sm px-1 py-0.5">
                <Avatar className="h-7 w-7 sm:h-8 sm:w-8">
                  <AvatarImage src={user.avatarUrl} alt={user.name} className="object-cover" />
                  <AvatarFallback className="bg-forest/10 text-forest text-xs font-semibold">
                    {user.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="max-w-[120px] truncate">{user.name}</span>
                <ChevronDown size={14} className="text-slate-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setChangePasswordModalOpen(true)}
                className="cursor-pointer"
              >
                <KeyRound size={16} className="mr-2 text-slate-500" />
                <span>Alterar Senha</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setProfilePhotoModalOpen(true)}
                className="cursor-pointer"
              >
                <UserIcon size={16} className="mr-2 text-slate-500" />
                <span>Adicionar Foto de Perfil</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer text-rose-600 focus:text-rose-700 focus:bg-rose-50 dark:focus:bg-rose-950/30"
              >
                <LogOut size={16} className="mr-2" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <ImportPlanilhaModal open={importModalOpen} onOpenChange={setImportModalOpen} />
      <UploadFotosModal open={uploadModalOpen} onOpenChange={setUploadModalOpen} />
      <ExportFolhaModal open={exportFolhaModalOpen} onOpenChange={setExportFolhaModalOpen} />
      <ChangePasswordModal
        open={changePasswordModalOpen}
        onOpenChange={setChangePasswordModalOpen}
      />
      <ProfilePhotoModal open={profilePhotoModalOpen} onOpenChange={setProfilePhotoModalOpen} />
    </header>
  )
}
