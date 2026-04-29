import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider, useAuth } from '@/hooks/use-auth'
import Index from './pages/Index'
import Dashboard from './pages/Dashboard'
import Camera from './pages/Camera'
import Layout from './components/Layout'

function ProtectedRoute({
  children,
  allowedRole,
}: {
  children: React.ReactNode
  allowedRole: 'gestor' | 'caixa'
}) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/" replace />
  if (user.role !== allowedRole) {
    return <Navigate to={user.role === 'gestor' ? '/dashboard' : '/camera'} replace />
  }
  return <>{children}</>
}

const AppRoutes = () => (
  <Routes>
    <Route element={<Layout />}>
      <Route path="/" element={<Index />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRole="gestor">
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/camera"
        element={
          <ProtectedRoute allowedRole="caixa">
            <Camera />
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
