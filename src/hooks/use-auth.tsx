import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import pb from '@/lib/pocketbase/client'

export type Role = 'Administrador' | 'recebedoria' | 'DP'

export interface User {
  id: string
  name: string
  role: Role
  email: string
  garagem?: string
  avatarUrl?: string
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  login: (email: string, pass: string) => Promise<{ error: any }>
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const mapUser = (record: any): User | null => {
      if (!record) return null
      return {
        id: record.id,
        name: record.name || (record.email ? record.email.split('@')[0] : 'Usuário'),
        role: record.tipo_usuario as Role,
        email: record.email || '',
        garagem: record.garagem,
        avatarUrl: record.avatar ? pb.files.getURL(record, record.avatar) : undefined,
      }
    }

    const syncUser = () => {
      if (pb.authStore.isValid && pb.authStore.record) {
        setUser(mapUser(pb.authStore.record))
        setIsAuthenticated(true)
      } else {
        setUser(null)
        setIsAuthenticated(false)
      }
      setLoading(false)
    }

    syncUser()

    if (!pb.authStore.isValid && pb.authStore.record) {
      pb.authStore.clear()
    }

    const unsubscribe = pb.authStore.onChange((_token, record) => {
      if (pb.authStore.isValid) {
        setUser(mapUser(record))
        setIsAuthenticated(true)
      } else {
        setUser(null)
        setIsAuthenticated(false)
      }
    })

    const interval = setInterval(() => {
      if (!pb.authStore.isValid && pb.authStore.record) {
        pb.authStore.clear()
        if (window.location.pathname !== '/') {
          window.location.href = '/'
        }
      }
    }, 30000)

    return () => {
      unsubscribe()
      clearInterval(interval)
    }
  }, [])

  const login = async (email: string, pass: string) => {
    try {
      await pb.collection('users').authWithPassword(email, pass)
      return { error: null }
    } catch (error) {
      return { error }
    }
  }

  const logout = () => {
    pb.authStore.clear()
    setUser(null)
    setIsAuthenticated(false)
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
