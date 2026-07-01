import { useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  UploadCloud,
  CheckCircle2,
  XCircle,
  FileImage,
  Loader2,
  X,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import pb from '@/lib/pocketbase/client'
import { toast } from 'sonner'

interface UploadFotosModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type FileStatus = 'pending' | 'uploading' | 'success' | 'error'

interface FileItem {
  id: string
  file: File
  status: FileStatus
  error?: string
  registro?: string
}

export function UploadFotosModal({ open, onOpenChange }: UploadFotosModalProps) {
  const [files, setFiles] = useState<FileItem[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return
    const newFiles: FileItem[] = Array.from(selectedFiles)
      .filter((f) => f.name.match(/^\d+\.(jpe?g|png)$/i))
      .map((file) => ({
        id: Math.random().toString(36).substring(7),
        file,
        status: 'pending',
      }))

    setFiles((prev) => [...prev, ...newFiles])
  }

  const processUploads = async () => {
    setIsProcessing(true)
    let successCount = 0
    let errorCount = 0
    const currentFiles = [...files]

    for (let i = 0; i < currentFiles.length; i++) {
      if (currentFiles[i].status === 'success') continue

      currentFiles[i].status = 'uploading'
      setFiles([...currentFiles])

      try {
        const file = currentFiles[i].file
        const match = file.name.match(/^(\d+)\.(jpe?g|png)$/i)
        if (!match) {
          throw new Error('Nome do arquivo inválido. Use apenas o registro (ex: 12345.jpg)')
        }

        const registroTrimmed = match[1]
        const extension = match[2].toLowerCase()

        currentFiles[i].registro = registroTrimmed

        let filialName = ''
        try {
          const colab = await pb
            .collection('colaboradores')
            .getFirstListItem(`registro="${registroTrimmed}"`)
          if (colab.filial) filialName = colab.filial
        } catch (err) {
          // Colaborador não encontrado, continua sem filial
        }

        const newFilename = `${registroTrimmed}_${Date.now()}.${extension}`
        const newFile = new File([file], newFilename, { type: file.type })

        const formData = new FormData()
        formData.append('foto', newFile)
        formData.append('registro', registroTrimmed)
        formData.append('origem', 'lote')
        if (filialName) {
          formData.append('filial', filialName)
        }
        formData.append('data_upload', new Date().toISOString())

        let fotoRecord
        try {
          const existing = await pb
            .collection('fotos_colaboradores')
            .getFirstListItem(`registro="${registroTrimmed}"`)
          fotoRecord = await pb.collection('fotos_colaboradores').update(existing.id, formData)
        } catch {
          fotoRecord = await pb.collection('fotos_colaboradores').create(formData)
        }

        const fotoUrl = pb.files.getURL(fotoRecord, fotoRecord.foto)
        await pb.collection('fotos_colaboradores').update(fotoRecord.id, { foto_url: fotoUrl })

        currentFiles[i].status = 'success'
        successCount++
        toast.success(`Foto enviada com sucesso para registro ${registroTrimmed}`)
      } catch (error: any) {
        currentFiles[i].status = 'error'
        currentFiles[i].error = error?.message?.includes('Nome do arquivo')
          ? error.message
          : 'Erro ao enviar foto'
        errorCount++
      }
      setFiles([...currentFiles])
    }

    setIsProcessing(false)
    if (errorCount > 0) {
      toast.error(`${errorCount} fotos falharam. Verifique os erros.`)
    }
  }

  const removeFile = (id: string) => {
    if (isProcessing) return
    setFiles(files.filter((f) => f.id !== id))
  }

  const reset = () => {
    if (isProcessing) return
    setFiles([])
  }

  const totalFiles = files.length
  const processedFiles = files.filter((f) => f.status === 'success' || f.status === 'error').length
  const progress = totalFiles > 0 ? Math.round((processedFiles / totalFiles) * 100) : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Upload de Fotos</DialogTitle>
          <DialogDescription>
            Envie fotos dos colaboradores em lote. O sistema irá vincular automaticamente aos
            registros.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4">
          {!isProcessing && files.length === 0 && (
            <div
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-200 ease-in-out cursor-pointer',
                isDragging
                  ? 'border-forest bg-mint/5'
                  : 'border-muted-foreground/25 hover:border-forest/50',
              )}
              onDragOver={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsDragging(true)
              }}
              onDragLeave={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsDragging(false)
              }}
              onDrop={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setIsDragging(false)
                handleFiles(e.dataTransfer.files)
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud className="mx-auto h-12 w-12 text-forest mb-4" />
              <p className="text-sm font-medium text-forest">Upload de Fotos</p>
              <p className="text-xs text-muted-foreground mt-1">
                Apenas .jpg, .jpeg, .png. Padrão: [registro].jpg
              </p>
              <input
                type="file"
                multiple
                accept=".jpg,.jpeg,.png"
                className="hidden"
                ref={fileInputRef}
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>
          )}

          {files.length > 0 && (
            <div className="flex flex-col gap-2 flex-1 overflow-hidden">
              <div className="flex items-center justify-between text-sm font-medium">
                <span className="text-forest">Arquivos ({files.length})</span>
                {isProcessing && <span className="text-mint">{progress}% Concluído</span>}
              </div>

              {isProcessing && (
                <Progress value={progress} className="h-2 bg-mint/20 [&>div]:bg-forest" />
              )}

              <ScrollArea className="flex-1 border border-mint/20 rounded-md">
                <div className="p-4 flex flex-col gap-3">
                  {files.map((fileItem) => (
                    <div
                      key={fileItem.id}
                      className="flex items-start gap-3 bg-muted/30 border border-border/50 p-3 rounded-md"
                    >
                      <div className="mt-0.5">
                        {fileItem.status === 'pending' && (
                          <FileImage className="h-5 w-5 text-muted-foreground" />
                        )}
                        {fileItem.status === 'uploading' && (
                          <Loader2 className="h-5 w-5 text-forest animate-spin" />
                        )}
                        {fileItem.status === 'success' && (
                          <CheckCircle2 className="h-5 w-5 text-mint" />
                        )}
                        {fileItem.status === 'error' && (
                          <XCircle className="h-5 w-5 text-destructive" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <p className="text-sm font-medium truncate">{fileItem.file.name}</p>
                          {!isProcessing && fileItem.status !== 'success' && (
                            <button
                              onClick={() => removeFile(fileItem.id)}
                              className="text-muted-foreground hover:text-destructive p-1 transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        {fileItem.error ? (
                          <div className="flex items-center text-xs text-destructive mt-1">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            {fileItem.error}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {(fileItem.file.size / 1024).toFixed(1)} KB
                            {fileItem.status === 'uploading' && ' - Enviando foto...'}
                            {fileItem.status === 'success' &&
                              ` - Vinculado (Reg: ${fileItem.registro})`}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  {!isProcessing && (
                    <Button
                      variant="outline"
                      className="w-full mt-2 border-dashed border-forest/30 text-forest hover:bg-forest/5"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <UploadCloud className="mr-2 h-4 w-4" /> Adicionar mais fotos
                    </Button>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-2">
          {!isProcessing && files.length > 0 && (
            <Button variant="outline" onClick={reset}>
              Limpar Tudo
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isProcessing}>
            {isProcessing ? 'Aguarde...' : 'Fechar'}
          </Button>
          {files.length > 0 &&
            files.some((f) => f.status === 'pending' || f.status === 'error') && (
              <Button
                onClick={processUploads}
                disabled={isProcessing}
                className="bg-forest hover:bg-forest/90 text-white"
              >
                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isProcessing
                  ? 'Processando...'
                  : files.some((f) => f.status === 'error')
                    ? 'Tentar novamente'
                    : 'Iniciar Upload'}
              </Button>
            )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
