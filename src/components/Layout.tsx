import { Outlet } from 'react-router-dom'
import { Header } from '@/components/Header'

export default function Layout() {
  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-sans">
      <Header />
      <main className="flex-grow flex flex-col w-full animate-fade-in pb-8">
        <Outlet />
      </main>
    </div>
  )
}
