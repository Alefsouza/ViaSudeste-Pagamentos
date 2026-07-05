import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider, useAuth, Role } from '@/hooks/use-auth'
import { toast } from 'sonner'
import { useEffect } from 'react'
import Index from './pages/Index'
import Dashboard from './pages/Dashboard'
import Camera from './pages/Camera'
import RelatorioRecebedoria from './pages/RelatorioRecebedoria'
import Usuarios from './pages/Usuarios'
import GestaoRegistros from './pages/GestaoRegistros'
import DPFotos from './pages/DPFotos'
import Layout from './components/Layout'

function RedirectWithToast({ to, message }: { to: string; message: string }) {
  useEffect(() => {
    toast.error(message)
  }, [message])
  return <Navigate to={to} replace />
}

function ProtectedRoute({
  children,
  allowedRoles,
  allowedEmails,
  allowedEmailsAny,
}: {
  children: React.ReactNode
  allowedRoles: Role[]
  allowedEmails?: string[]
  allowedEmailsAny?: string[]
}) {
  const { user, isAuthenticated, loading } = useAuth()

  if (loading) return null

  if (!isAuthenticated || !user) return <Navigate to="/" replace />

  const hasAnyEmail = allowedEmailsAny?.includes(user.email)

  if (!allowedRoles.includes(user.role) && !hasAnyEmail) {
    const to =
      user.role === 'Administrador' ? '/dashboard' : user.role === 'DP' ? '/dp/fotos' : '/camera'
    return <Navigate to={to} replace />
  }

  if (allowedEmails && !allowedEmails.includes(user.email)) {
    const to =
      user.role === 'Administrador' ? '/dashboard' : user.role === 'DP' ? '/dp/fotos' : '/camera'
    return <RedirectWithToast to={to} message="Você não tem permissão para acessar esta área." />
  }

  return <>{children}</>
}

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Index />} />
    <Route element={<Layout />}>
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={['Administrador']}>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/usuarios"
        element={
          <ProtectedRoute allowedRoles={['Administrador']} allowedEmails={['ti@viasudeste.com']}>
            <Usuarios />
          </ProtectedRoute>
        }
      />
      <Route
        path="/gestao-registros"
        element={
          <ProtectedRoute allowedRoles={['Administrador']}>
            <GestaoRegistros />
          </ProtectedRoute>
        }
      />
      <Route
        path="/camera"
        element={
          <ProtectedRoute allowedRoles={['recebedoria', 'Administrador']}>
            <Camera />
          </ProtectedRoute>
        }
      />
      <Route
        path="/relatorio-recebedoria"
        element={
          <ProtectedRoute allowedRoles={['recebedoria', 'Administrador']}>
            <RelatorioRecebedoria />
          </ProtectedRoute>
        }
      />
      <Route
        path="/relatorio"
        element={
          <ProtectedRoute allowedRoles={['Administrador']}>
            <RelatorioRecebedoria />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dp/fotos"
        element={
          <ProtectedRoute
            allowedRoles={['DP', 'recebedoria']}
            allowedEmailsAny={['clayton.souza@viasudeste.com']}
          >
            <DPFotos />
          </ProtectedRoute>
        }
      />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
)

const App = () => (
  <BrowserRouter future={{ v7_startTransition: false, v7_relativeSplatPath: false }}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AppRoutes />
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
