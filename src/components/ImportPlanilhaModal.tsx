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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
  const [dataLiberacao, setDataLiberacao] = useState('')
  const [periodoInicio, setPeriodoInicio] = useState('')
  const [periodoFim, setPeriodoFim] = useState('')
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
            const utcDate = new Date(Math.round((serial - 25569) * 86400 * 1000))
            return new Date(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate())
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
            const hours = Math.floor(totalSeconds / 3600) % 24
            const minutes = Math.floor((totalSeconds % 3600) / 60)
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
          }
          if (typeof serial === 'string') {
            const parts = serial.split(':')
            if (parts.length >= 2) {
              return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`
            }
          }
          return String(serial || '').trim()
        }

        const formatHoras = (val: any) => {
          if (typeof val === 'number') {
            let hours = val
            if (val > 0 && val < 1) {
              hours = val * 24
            }
            return Number(hours).toFixed(2).padStart(5, '0')
          }
          if (typeof val === 'string') {
            const num = parseFloat(val.replace(',', '.'))
            return isNaN(num) ? val : num.toFixed(2).padStart(5, '0')
          }
          return '00.00'
        }

        const normalizedData = jsonData.map((row: any) => {
          const newRow: Record<string, any> = {}
          Object.keys(row).forEach((k) => {
            const normalizedKey = String(k).toUpperCase().trim()
            newRow[normalizedKey] = row[k]
          })
          return newRow
        })

        const parseValor = (val: any): number => {
          if (typeof val === 'number') return Number(val.toFixed(2))
          if (!val) return 0
          const strVal = String(val).trim()
          // Remove optional currency symbols and spaces (e.g. "R$ ")
          const cleanCurrency = strVal.replace(/^R\$\s*/i, '')
          // If there's a comma, treat as decimal separator and remove dots
          if (cleanCurrency.includes(',')) {
            const cleanStr = cleanCurrency.replace(/\./g, '').replace(',', '.')
            const num = parseFloat(cleanStr)
            return isNaN(num) ? 0 : Number(num.toFixed(2))
          }
          // If only dots or no separators, parse directly
          const num = parseFloat(cleanCurrency)
          return isNaN(num) ? 0 : Number(num.toFixed(2))
        }

        const parseDateToDB = (val: any) => {
          if (val === undefined || val === null || val === '') return ''
          let d: Date
          if (typeof val === 'number') {
            const utcDate = new Date(Math.round((val - 25569) * 86400 * 1000))
            d = new Date(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate())
          } else if (typeof val === 'string') {
            const dateOnly = String(val).split(' ')[0]
            const parts = dateOnly.split('/')
            if (parts.length === 3) {
              let year = parseInt(parts[2])
              if (year < 100) year += 2000 // handle YY format
              d = new Date(year, parseInt(parts[1]) - 1, parseInt(parts[0]))
            } else {
              d = new Date(val)
            }
          } else {
            return ''
          }
          if (!isNaN(d.getTime())) {
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} 12:00:00.000Z`
          }
          return ''
        }

        const formattedData = normalizedData.map((row: any) => {
          const rawData = row['DATA']
          const d = excelDateToJSDate(rawData)
          const dataFormatted = !isNaN(d.getTime())
            ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
            : String(rawData || '')

          const dataPagamentoV2 = !isNaN(d.getTime())
            ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} 12:00:00.000Z`
            : ''

          let rawFilial = row['FILIAL'] !== undefined ? String(row['FILIAL']).trim() : ''
          let filialNumber = 0
          if (!isNaN(Number(rawFilial)) && rawFilial !== '') {
            filialNumber = Number(rawFilial)
          }
          let filialMapped = ''
          if (filialNumber === 2) filialMapped = 'Sapopemba'
          else if (filialNumber === 3 || filialNumber === 4) filialMapped = 'Cursino'

          return {
            registro: String(row['REGISTRO'] || ''),
            nome: String(row['NOME'] || ''),
            data: dataFormatted,
            idtipopgto: Number(row['IDTIPOPGTO']) || 0,
            inicio: excelTimeToHHMM(row['INICIO']),
            termino: excelTimeToHHMM(row['TERMINO']),
            horas: formatHoras(row['HORAS']),
            valor_a_receber: parseValor(row['VALOR']),
            valor: parseValor(row['VALOR']),
            filial: filialMapped,
            filial_id: filialNumber,
            data_pagamento_v2: dataPagamentoV2,
            data_liberacao: parseDateToDB(row['DATA_LIBERACAO'] || row['DATA LIBERACAO']),
            periodo_inicio: parseDateToDB(row['PERIODO_INICIO'] || row['PERIODO INICIO']),
            periodo_fim: parseDateToDB(row['PERIODO_FIM'] || row['PERIODO FIM']),
          }
        })

        const res = await pb.send('/backend/v1/import/colaboradores', {
          method: 'POST',
          body: JSON.stringify({
            data: formattedData,
            dataLiberacao,
            periodoInicio,
            periodoFim,
          }),
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
          setDataLiberacao('')
          setPeriodoInicio('')
          setPeriodoFim('')
        }
      }}
    >
      <DialogContent className="sm:max-w-3xl w-11/12 overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-center">Importar Planilha</DialogTitle>
          <DialogDescription className="text-center">
            Faça upload de uma planilha Excel (.xlsx, .xls) para atualizar ou cadastrar
            colaboradores.
          </DialogDescription>
        </DialogHeader>

        <div
          className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-lg mt-2 transition-colors w-full ${!file ? 'cursor-pointer' : ''} ${isDragging ? 'border-primary bg-primary/5' : 'border-border bg-muted/20'} ${loading ? 'opacity-50 pointer-events-none' : ''}`}
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
            <div className="flex flex-col items-center gap-4 w-full overflow-hidden">
              <div className="flex items-center gap-3 bg-background p-3 rounded-md w-full border shadow-sm max-w-full">
                <FileSpreadsheet className="h-8 w-8 text-emerald-600 shrink-0" />
                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className="text-sm font-medium truncate w-full">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    setFile(null)
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full text-left my-2">
                <div className="space-y-2">
                  <Label htmlFor="dataLiberacao">Data de Liberação</Label>
                  <Input
                    id="dataLiberacao"
                    type="date"
                    value={dataLiberacao}
                    onChange={(e) => setDataLiberacao(e.target.value)}
                    disabled={loading || confirming}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="periodoInicio">Período da Referência (Início)</Label>
                  <Input
                    id="periodoInicio"
                    type="date"
                    value={periodoInicio}
                    onChange={(e) => setPeriodoInicio(e.target.value)}
                    disabled={loading || confirming}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="periodoFim">Período da Referência (Fim)</Label>
                  <Input
                    id="periodoFim"
                    type="date"
                    value={periodoFim}
                    onChange={(e) => setPeriodoFim(e.target.value)}
                    disabled={loading || confirming}
                  />
                </div>
              </div>

              {!confirming ? (
                <Button onClick={() => setConfirming(true)} disabled={loading} className="w-full">
                  Verificar Importação
                </Button>
              ) : (
                <div className="w-full p-4 border rounded-md bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 animate-fade-in-up">
                  <p className="text-sm text-amber-800 dark:text-amber-200 font-medium mb-4 text-center">
                    Tem certeza que deseja importar estes dados? Um novo registro será criado para
                    cada linha.
                  </p>
                  <div className="flex gap-2 justify-center w-full">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirming(false)}
                      disabled={loading}
                      className="flex-1"
                    >
                      Cancelar
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleUpload}
                      disabled={loading}
                      className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin mx-auto" />
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
