import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { ScanFace, RefreshCw, CheckCircle2, Search, User } from 'lucide-react'
import { getColaboradores } from '@/services/colaboradores'

export default function Camera() {
  const { user } = useAuth()
  const [scanning, setScanning] = useState(true)
  const [colabs, setColabs] = useState<any[]>([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    getColaboradores().then(setColabs)
  }, [])

  useEffect(() => {
    if (scanning) {
      const timer = setTimeout(() => setScanning(false), 4000)
      return () => clearTimeout(timer)
    }
  }, [scanning])

  const filteredColabs = colabs.filter(
    (c) =>
      c.nome.toLowerCase().includes(search.toLowerCase()) ||
      c.registro.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4 flex flex-col items-center">
      <div className="w-full text-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Reconhecimento Facial</h1>
        <p className="text-slate-500 mt-2">Operador: {user?.name}</p>
      </div>

      <div className="relative w-full aspect-video bg-slate-950 rounded-2xl overflow-hidden shadow-2xl border-4 border-slate-800 flex items-center justify-center">
        <div className="absolute inset-0 opacity-20 bg-[url('https://img.usecurling.com/p/800/600?q=retail%20store')] bg-cover bg-center mix-blend-luminosity" />
        <div className="absolute top-8 left-8 w-16 h-16 border-t-4 border-l-4 border-blue-500 rounded-tl-xl" />
        <div className="absolute top-8 right-8 w-16 h-16 border-t-4 border-r-4 border-blue-500 rounded-tr-xl" />
        <div className="absolute bottom-8 left-8 w-16 h-16 border-b-4 border-l-4 border-blue-500 rounded-bl-xl" />
        <div className="absolute bottom-8 right-8 w-16 h-16 border-b-4 border-r-4 border-blue-500 rounded-br-xl" />

        {scanning ? (
          <>
            <div className="absolute top-0 w-full h-1 bg-emerald-500 shadow-[0_0_20px_4px_#10b981] animate-scan-line z-20" />
            <div className="z-10 flex flex-col items-center animate-pulse text-emerald-400">
              <ScanFace size={64} className="mb-4 opacity-50" />
              <p className="text-lg font-medium tracking-widest uppercase">Escaneando...</p>
            </div>
          </>
        ) : (
          <div className="z-10 flex flex-col items-center text-emerald-500 animate-slide-up">
            <CheckCircle2 size={64} className="mb-4" />
            <p className="text-lg font-medium tracking-widest uppercase">Pronto para Captura</p>
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-col sm:flex-row gap-4 w-full max-w-md">
        <Button
          className="flex-1 bg-blue-600 hover:bg-blue-700 h-12 text-base transition-all active:scale-[0.98]"
          onClick={() => setScanning(false)}
          disabled={!scanning}
        >
          Capturar Manualmente
        </Button>
        <Button
          variant="outline"
          className="flex-1 h-12 text-base transition-all active:scale-[0.98] border-slate-300 dark:border-slate-700"
          onClick={() => setScanning(true)}
          disabled={scanning}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${scanning ? 'animate-spin text-blue-500' : ''}`} />
          Reiniciar Scanner
        </Button>
      </div>

      <div className="mt-12 w-full max-w-2xl">
        <div className="relative mb-6">
          <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
          <Input
            placeholder="Buscar colaborador por nome ou registro..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-12 text-base"
          />
        </div>

        <div className="space-y-3">
          {filteredColabs.slice(0, 5).map((colab) => (
            <Card key={colab.id} className="hover:border-blue-500 transition-colors cursor-pointer">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                  <User className="h-5 w-5 text-slate-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 dark:text-white">{colab.nome}</h3>
                  <p className="text-sm text-slate-500">
                    Registro: {colab.registro} • Filial: {colab.filial}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-medium text-emerald-600">
                    R$ {colab.valor_a_receber.toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredColabs.length === 0 && (
            <p className="text-center text-slate-500 py-8">Nenhum colaborador encontrado.</p>
          )}
        </div>
      </div>
    </div>
  )
}
