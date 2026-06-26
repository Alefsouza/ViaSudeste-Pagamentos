import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

interface PhotoPreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  fotoUrl: string | null
  registro: string
  nome: string
}

export function PhotoPreviewModal({
  open,
  onOpenChange,
  fotoUrl,
  registro,
  nome,
}: PhotoPreviewModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {registro} {nome ? `- ${nome}` : ''}
          </DialogTitle>
          <DialogDescription>Visualização ampliada da foto do colaborador</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-center rounded-xl bg-slate-100/50 dark:bg-slate-900/50 p-2 mt-4 relative overflow-hidden">
          {fotoUrl ? (
            <img
              src={fotoUrl}
              alt={`Foto de ${nome || registro}`}
              className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-md border border-slate-200 dark:border-slate-800"
            />
          ) : (
            <div className="flex h-64 w-full items-center justify-center text-slate-500 text-sm border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
              Nenhuma foto disponível
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
