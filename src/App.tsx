import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider, useAuth, Role } from '@/hooks/use-auth'
import Index from './pages/Index'
import Dashboard from './pages/Dashboard'
import Camera from './pages/Camera'
import RelatorioRecebedoria from './pages/RelatorioRecebedoria'
import Usuarios from './pages/Usuarios'
import GestaoRegistros from './pages/GestaoRegistros'
import DPFotos from './pages/DPFotos'
import Layout from './components/Layout'

function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode
  allowedRoles: Role[]
}) {
  const { user, loading } = useAuth()

  if (loading) return null

  if (!user) return <Navigate to="/" replace />
  if (!allowedRoles.includes(user.role)) {
    if (user.role === 'Administrador') return <Navigate to="/dashboard" replace />
    if (user.role === 'DP') return <Navigate to="/dp/fotos" replace />
    return <Navigate to="/camera" replace />
  }
  return children
}

const AppRoutes = () => (
  <Routes>
    <Route element={<Layout />}>
      <Route path="/" element={<Index />} />
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
          <ProtectedRoute allowedRoles={['Administrador']}>
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
          <ProtectedRoute allowedRoles={['DP']}>
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
