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
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { exportFolha } from '@/services/export'

interface ExportFolhaModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ExportFolhaModal({ open, onOpenChange }: ExportFolhaModalProps) {
  const [loading, setLoading] = useState(false)
  const [competencia, setCompetencia] = useState(() => {
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    return `${yyyy}-${mm}`
  })

  const handleExport = async () => {
    if (!competencia) return

    try {
      setLoading(true)
      const [yyyy, mm] = competencia.split('-')
      const mmYyyy = `${mm}/${yyyy}`

      const txtContent = await exportFolha(mmYyyy)

      const lastDay = new Date(parseInt(yyyy, 10), parseInt(mm, 10), 0).getDate()
      const lastDayStr = String(lastDay).padStart(2, '0')
      const filename = `01.${mm}.${yyyy}_${lastDayStr}.${mm}.${yyyy}.txt`

      const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success('Download da folha iniciado com sucesso!')
      onOpenChange(false)
    } catch (error: any) {
      toast.error(error.message || 'Ocorreu um erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Exportar Folha</DialogTitle>
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleExport} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Exportar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
