import { Outlet } from 'react-router-dom'
import { Header } from '@/components/Header'

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-sans">
      <Header />
      <main className="flex-1 w-full animate-fade-in pb-8">
        <Outlet />
      </main>
      <footer className="py-4 border-t bg-white dark:bg-slate-950 text-center text-sm text-slate-500 mt-auto shadow-[0_-1px_3px_rgba(0,0,0,0.05)]">
        <p>Via Sudeste Transportes SA</p>
      </footer>
    </div>
  )
}
