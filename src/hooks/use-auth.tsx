import { createContext, useContext, useState, ReactNode } from 'react'

export type Role = 'gestor' | 'caixa'

export interface User {
  id: string
  name: string
  role: Role
  email: string
}

interface AuthContextType {
  user: User | null
  login: (email: string, role: Role) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)

  const login = async (email: string, role: Role) => {
    return new Promise<void>((resolve, reject) => {
      setTimeout(() => {
        if (!email.includes('@')) {
          reject(new Error('Email inválido'))
          return
        }
        setUser({
          id: Math.random().toString(36).substring(7),
          name: email.split('@')[0],
          role,
          email,
        })
        resolve()
      }, 800)
    })
  }

  const logout = () => {
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
