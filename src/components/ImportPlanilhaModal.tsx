import { useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { UploadCloud, FileSpreadsheet, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import pb from '@/lib/pocketbase/client'

export function ImportPlanilhaModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0])
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0])
    }
    if (e.target) {
      e.target.value = ''
    }
  }

  const validateAndSetFile = (selectedFile: File) => {
    const validExtensions = ['.xlsx', '.xls']
    const fileExtension = selectedFile.name
      .substring(selectedFile.name.lastIndexOf('.'))
      .toLowerCase()

    if (validExtensions.includes(fileExtension)) {
      setFile(selectedFile)
    } else {
      toast.error('Formato inválido. Por favor, envie um arquivo .xlsx ou .xls.')
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setLoading(true)
    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const base64 = event.target?.result?.toString().split(',')[1]
        const res = await pb.send('/backend/v1/import/colaboradores', {
          method: 'POST',
          body: JSON.stringify({ fileBase64: base64 }),
        })

        toast.success(res.message || 'Colaboradores importados com sucesso')
        onOpenChange(false)
        setFile(null)
      } catch (error: any) {
        const errorMsg = error.response?.message || error.message || 'Erro desconhecido'
        const isValidationError = errorMsg.includes('Arquivo inválido. Verifique se tem as colunas')

        toast.error(isValidationError ? errorMsg : `Erro ao importar: ${errorMsg}`, {
          action: {
            label: 'Tentar novamente',
            onClick: () => {},
          },
        })
      } finally {
        setLoading(false)
      }
    }

    reader.onerror = () => {
      toast.error('Erro ao ler o arquivo localmente.')
      setLoading(false)
    }

    reader.readAsDataURL(file)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!loading) onOpenChange(val)
        if (!val) setFile(null)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importar Planilha</DialogTitle>
          <DialogDescription>
            Faça upload de uma planilha Excel (.xlsx, .xls) para atualizar ou cadastrar
            colaboradores.
          </DialogDescription>
        </DialogHeader>

        <div
          className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg mt-2 transition-colors ${!file ? 'cursor-pointer' : ''} ${isDragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/20'} ${loading ? 'opacity-50 pointer-events-none' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !file && fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
          />

          {file ? (
            <div className="flex flex-col items-center gap-4 w-full">
              <div className="flex items-center gap-3 bg-background p-3 rounded-md w-full border shadow-sm">
                <FileSpreadsheet className="h-8 w-8 text-emerald-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation()
                    setFile(null)
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <Button onClick={handleUpload} disabled={loading} className="w-full">
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importando planilha...
                  </>
                ) : (
                  'Confirmar Importação'
                )}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center">
              <UploadCloud className="h-10 w-10 text-muted-foreground mb-4" />
              <p className="text-sm font-medium mb-1">Clique para buscar ou arraste o arquivo</p>
              <p className="text-xs text-muted-foreground">Apenas arquivos .xlsx ou .xls</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
