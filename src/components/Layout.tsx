import { Outlet } from 'react-router-dom'
import { Header } from '@/components/Header'

export default function Layout() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-sans">
      <Header />
      <main className="flex-grow flex flex-col w-full animate-fade-in pb-8">
        <Outlet />
      </main>
      <footer className="relative mt-auto p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-400 text-center text-sm">
        <p>Via Sudeste</p>
      </footer>
    </div>
  )
}
