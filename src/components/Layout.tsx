import { Outlet } from 'react-router-dom'
import { Header } from '@/components/Header'

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-sans">
      <Header />
      <main className="flex-1 w-full animate-fade-in">
        <Outlet />
      </main>
    </div>
  )
}
