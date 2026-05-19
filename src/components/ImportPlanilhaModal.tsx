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
  const [confirming, setConfirming] = useState(false)
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
      setConfirming(false)
    } else {
      toast.error('Formato inválido. Por favor, envie um arquivo .xlsx ou .xls.')
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setLoading(true)

    const processFile = async () => {
      try {
        const XLSX = (window as any).XLSX
        if (!XLSX) {
          throw new Error('Biblioteca de leitura de planilhas não carregada.')
        }

        const data = await file.arrayBuffer()
        const workbook = XLSX.read(data, { type: 'array' })
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]

        if (!worksheet || !worksheet['!ref']) {
          throw new Error('Planilha vazia.')
        }

        const range = XLSX.utils.decode_range(worksheet['!ref'])
        const headers: string[] = []
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cell = worksheet[XLSX.utils.encode_cell({ c: C, r: range.s.r })]
          if (cell && cell.v) headers.push(String(cell.v).toUpperCase().trim())
        }

        const requiredCols = [
          'REGISTRO',
          'NOME',
          'DATA',
          'IDTIPOPGTO',
          'INICIO',
          'TERMINO',
          'HORAS',
          'VALOR',
          'FILIAL',
        ]
        const hasAllCols = requiredCols.every((col) => headers.includes(col))

        if (!hasAllCols) {
          throw new Error(
            'Arquivo invalido. Verifique se tem as colunas: REGISTRO, NOME, DATA, IDTIPOPGTO, INICIO, TERMINO, HORAS, VALOR, FILIAL',
          )
        }

        const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: true, defval: '' })

        const excelDateToJSDate = (serial: any) => {
          if (typeof serial === 'number') {
            return new Date(Math.round((serial - 25569) * 86400 * 1000))
          }
          if (typeof serial === 'string') {
            const parts = serial.split('/')
            if (parts.length === 3) {
              return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
            }
          }
          return new Date()
        }

        const excelTimeToHHMM = (serial: any) => {
          if (typeof serial === 'number') {
            const totalSeconds = Math.round(serial * 86400)
            const hours = Math.floor(totalSeconds / 3600)
            const minutes = Math.floor((totalSeconds % 3600) / 60)
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
          }
          return String(serial).trim()
        }

        const formatHoras = (val: any) => {
          if (typeof val === 'number') {
            if (val < 1) {
              const hours = val * 24
              return hours.toFixed(2).padStart(5, '0')
            }
            return Number(val).toFixed(2).padStart(5, '0')
          }
          if (typeof val === 'string') {
            const num = parseFloat(val.replace(',', '.'))
            return isNaN(num) ? val : num.toFixed(2).padStart(5, '0')
          }
          return '00.00'
        }

        const formattedData = jsonData.map((row: any) => {
          const rawData = row['DATA']
          const d = excelDateToJSDate(rawData)
          const dataFormatted = !isNaN(d.getTime())
            ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
            : String(rawData || '')

          return {
            REGISTRO: String(row['REGISTRO'] || ''),
            NOME: String(row['NOME'] || ''),
            DATA: dataFormatted,
            IDTIPOPGTO: Number(row['IDTIPOPGTO']) || 0,
            INICIO: excelTimeToHHMM(row['INICIO']),
            TERMINO: excelTimeToHHMM(row['TERMINO']),
            HORAS: formatHoras(row['HORAS']),
            VALOR: Number(parseFloat(String(row['VALOR'] || 0).replace(',', '.')).toFixed(2)) || 0,
            FILIAL: Number(row['FILIAL']) || 0,
          }
        })

        const res = await pb.send('/backend/v1/import/colaboradores', {
          method: 'POST',
          body: JSON.stringify({ data: formattedData }),
        })

        if (res.errors && res.errors.length > 0) {
          res.errors.forEach((err: string) => toast.error(err))
        }

        toast.success(`${res.count} registros importados com sucesso`)
        onOpenChange(false)
        setFile(null)
      } catch (error: any) {
        const errorMsg = error.response?.message || error.message || 'Erro desconhecido'
        const isValidationError = errorMsg.includes('Arquivo invalido')

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

    if (!(window as any).XLSX) {
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
      script.onload = processFile
      script.onerror = () => {
        toast.error('Erro ao carregar dependência para leitura de planilhas.')
        setLoading(false)
      }
      document.body.appendChild(script)
    } else {
      processFile()
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!loading) onOpenChange(val)
        if (!val) {
          setFile(null)
          setConfirming(false)
        }
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
              {!confirming ? (
                <Button onClick={() => setConfirming(true)} disabled={loading} className="w-full">
                  Verificar Importação
                </Button>
              ) : (
                <div className="mt-2 p-4 border rounded-md bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 animate-fade-in-up">
                  <p className="text-sm text-amber-800 dark:text-amber-200 font-medium mb-4">
                    Tem certeza que deseja importar estes dados? Registros existentes poderão ser
                    atualizados e novos serão criados.
                  </p>
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirming(false)}
                      disabled={loading}
                    >
                      Cancelar
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleUpload}
                      disabled={loading}
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importando planilha...
                        </>
                      ) : (
                        'Sim, importar'
                      )}
                    </Button>
                  </div>
                </div>
              )}
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
