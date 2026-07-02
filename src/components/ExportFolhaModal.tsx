import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Loader2, FileText, FileSpreadsheet, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { exportFolha } from '@/services/export-folha'
import { exportFolhaDetalhada } from '@/services/export-folha-detalhada'
import { generateDetailedPDF } from '@/lib/detailed-report'

type Mode = 'select' | 'mensal' | 'detalhada'

interface ExportFolhaModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ExportFolhaModal({ open, onOpenChange }: ExportFolhaModalProps) {
  const [mode, setMode] = useState<Mode>('select')
  const [loading, setLoading] = useState(false)
  const [competencia, setCompetencia] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [registro, setRegistro] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFinal, setDataFinal] = useState('')

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setMode('select')
      setLoading(false)
      setRegistro('')
      setDataInicio('')
      setDataFinal('')
    }
    onOpenChange(nextOpen)
  }

  const handleMonthlyExport = async () => {
    if (!competencia) return
    try {
      setLoading(true)
      const [yyyy, mm] = competencia.split('-')
      const mmYyyy = `${mm}/${yyyy}`
      const result = await exportFolha(mmYyyy)

      if (!result.success) {
        toast.error(result.message)
        return
      }

      let filename = result.filename
      if (!filename) {
        const lastDay = new Date(parseInt(yyyy, 10), parseInt(mm, 10), 0).getDate()
        filename = `01.${mm}.${yyyy}_${String(lastDay).padStart(2, '0')}.${mm}.${yyyy}.txt`
      }

      const url = URL.createObjectURL(result.blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success('Download da folha iniciado com sucesso!')
      handleClose(false)
    } catch (error: any) {
      toast.error(error.message || 'Ocorreu um erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  const handleDetailedExport = async () => {
    if (!registro.trim()) {
      toast.error('Informe o registro do colaborador.')
      return
    }
    if (!dataInicio) {
      toast.error('Informe a data inicial.')
      return
    }
    if (!dataFinal) {
      toast.error('Informe a data final.')
      return
    }
    if (dataFinal < dataInicio) {
      toast.error('A data final não pode ser anterior à data inicial.')
      return
    }

    try {
      setLoading(true)
      const result = await exportFolhaDetalhada(registro.trim(), dataInicio, dataFinal)

      if (!result.success || !result.data) {
        toast.error(result.message || 'Nenhum registro para os critérios informados.')
        return
      }

      const printed = generateDetailedPDF(
        result.data.items,
        result.data.total,
        result.data.registro,
        dataInicio,
        dataFinal,
      )

      if (!printed) {
        toast.error(
          'Não foi possível abrir a janela de impressão. Verifique o bloqueador de pop-ups.',
        )
        return
      }

      toast.success('Relatório detalhado gerado com sucesso!')
      handleClose(false)
    } catch (error: any) {
      toast.error(error.message || 'Ocorreu um erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        {mode === 'select' && (
          <>
            <DialogHeader>
              <DialogTitle>Exportar Folha</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
              <button
                onClick={() => setMode('mensal')}
                disabled={loading}
                className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-border hover:border-primary hover:bg-accent transition-all duration-200 cursor-pointer group"
              >
                <FileSpreadsheet className="h-10 w-10 text-primary group-hover:scale-110 transition-transform" />
                <div className="text-center">
                  <p className="font-semibold text-sm">Exportação Mensal</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Folha de pagamento por competência
                  </p>
                </div>
              </button>
              <button
                onClick={() => setMode('detalhada')}
                disabled={loading}
                className="flex flex-col items-center gap-3 p-6 rounded-lg border-2 border-border hover:border-primary hover:bg-accent transition-all duration-200 cursor-pointer group"
              >
                <FileText className="h-10 w-10 text-primary group-hover:scale-110 transition-transform" />
                <div className="text-center">
                  <p className="font-semibold text-sm">Exportação Detalhada</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Relatório individual por colaborador
                  </p>
                </div>
              </button>
            </div>
          </>
        )}

        {mode === 'mensal' && (
          <>
            <DialogHeader>
              <DialogTitle>Exportação Mensal</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="competencia" className="text-right">
                  Competência
                </Label>
                <Input
                  id="competencia"
                  type="month"
                  value={competencia}
                  onChange={(e) => setCompetencia(e.target.value)}
                  className="col-span-3"
                  disabled={loading}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMode('select')} disabled={loading}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
              </Button>
              <Button onClick={handleMonthlyExport} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Exportar
              </Button>
            </DialogFooter>
          </>
        )}

        {mode === 'detalhada' && (
          <>
            <DialogHeader>
              <DialogTitle>Exportação Detalhada</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="det-registro" className="text-right">
                  Registro
                </Label>
                <Input
                  id="det-registro"
                  type="text"
                  placeholder="Ex: 12345"
                  value={registro}
                  onChange={(e) => setRegistro(e.target.value)}
                  className="col-span-3"
                  disabled={loading}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="det-inicio" className="text-right">
                  Data Inicial
                </Label>
                <Input
                  id="det-inicio"
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="col-span-3"
                  disabled={loading}
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="det-final" className="text-right">
                  Data Final
                </Label>
                <Input
                  id="det-final"
                  type="date"
                  value={dataFinal}
                  onChange={(e) => setDataFinal(e.target.value)}
                  className="col-span-3"
                  disabled={loading}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMode('select')} disabled={loading}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
              </Button>
              <Button onClick={handleDetailedExport} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Gerar PDF
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
