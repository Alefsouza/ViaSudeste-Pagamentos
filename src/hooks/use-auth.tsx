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
  login: (email: string, pass: string) => Promise<{ error: any }>
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
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

    setUser(mapUser(pb.authStore.record))
    setLoading(false)

    const unsubscribe = pb.authStore.onChange((_token, record) => {
      setUser(mapUser(record))
    })

    return () => {
      unsubscribe()
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
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>{children}</AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
