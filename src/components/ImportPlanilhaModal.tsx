import { useState, useRef, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { UploadCloud, FileSpreadsheet, Loader2, X, Copy, Check, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import pb from '@/lib/pocketbase/client'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'

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
  const [dataLiberacao, setDataLiberacao] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [periodoInicio, setPeriodoInicio] = useState('')
  const [periodoFim, setPeriodoFim] = useState('')
  const [referencia, setReferencia] = useState('')
  const [progress, setProgress] = useState(0)
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      const fetchMaxRef = async () => {
        try {
          const rec = await pb
            .collection('colaboradores')
            .getFirstListItem('referencia > 0', { sort: '-referencia', fields: 'referencia' })
          setReferencia(String((rec.referencia || 0) + 1))
        } catch (e) {
          setReferencia('1')
        }
      }
      fetchMaxRef()
    }
  }, [open])

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
      setImportErrors([])
    } else {
      toast.error('Formato inválido. Por favor, envie um arquivo .xlsx ou .xls.')
    }
  }

  const handleCopyErrors = async () => {
    const errorText = importErrors.map((err, idx) => `${idx + 1}. ${err}`).join('\n')
    const fullText = `Erros de Importação (${importErrors.length} total):\n\n${errorText}`
    try {
      await navigator.clipboard.writeText(fullText)
      setCopied(true)
      toast.success('Erros copiados para a área de transferência')
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Erro ao copiar:', err)
      toast.error('Não foi possível copiar os erros')
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setLoading(true)
    setImportErrors([])

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
          if (typeof val === 'string') {
            const trimmed = val.trim()
            const match = trimmed.match(/^(\d+):(\d{2})$/)
            if (match) {
              return `${match[1].padStart(2, '0')}:${match[2]}`
            }
            const num = parseFloat(trimmed.replace(',', '.'))
            if (!isNaN(num)) {
              const totalMinutes = Math.round(num * 60)
              const hours = Math.floor(totalMinutes / 60)
              const minutes = totalMinutes % 60
              return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
            }
            return trimmed || '00:00'
          }

          if (typeof val === 'number') {
            if (val === 0) return '00:00'
            if (val > 0 && val < 1) {
              const totalMinutes = Math.round(val * 24 * 60)
              const hours = Math.floor(totalMinutes / 60)
              const minutes = totalMinutes % 60
              return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
            }
            if (val >= 1) {
              const totalMinutes = Math.round(val * 60)
              const hours = Math.floor(totalMinutes / 60)
              const minutes = totalMinutes % 60
              return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
            }
            return '00:00'
          }

          return '00:00'
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
          const cleanCurrency = strVal.replace(/^R\$\s*/i, '')
          if (cleanCurrency.includes(',')) {
            const cleanStr = cleanCurrency.replace(/\./g, '').replace(',', '.')
            const num = parseFloat(cleanStr)
            return isNaN(num) ? 0 : Number(num.toFixed(2))
          }
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
              if (year < 100) year += 2000
              d = new Date(year, parseInt(parts[1]) - 1, parseInt(parts[0]))
            } else {
              d = new Date(val)
            }
          } else {
            return ''
          }
          if (!isNaN(d.getTime())) {
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
          }
          return ''
        }

        const formatUIDateToDB = (dateStr: string) => {
          if (!dateStr) return ''
          return dateStr
        }

        const uiDataLiberacao = formatUIDateToDB(dataLiberacao)
        const uiPeriodoInicio = formatUIDateToDB(periodoInicio)
        const uiPeriodoFim = formatUIDateToDB(periodoFim)
        const refNumber = Number(referencia) || 0

        const formattedData = normalizedData.map((row: any) => {
          const rawData = row['DATA']
          const d = excelDateToJSDate(rawData)
          const dataFormatted = !isNaN(d.getTime())
            ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
            : String(rawData || '')

          const dataPagamentoV2 = !isNaN(d.getTime())
            ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
            : ''

          let rawFilial = row['FILIAL'] !== undefined ? String(row['FILIAL']).trim() : ''
          let filialNumber = 0
          if (!isNaN(Number(rawFilial)) && rawFilial !== '') {
            filialNumber = Number(rawFilial)
          }
          let filialMapped = ''
          if (filialNumber === 2) filialMapped = 'Cursino'
          else if (filialNumber === 4) filialMapped = 'Sapopemba'

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
            data_liberacao:
              uiDataLiberacao || parseDateToDB(row['DATA_LIBERACAO'] || row['DATA LIBERACAO']),
            periodo_inicio:
              uiPeriodoInicio || parseDateToDB(row['PERIODO_INICIO'] || row['PERIODO INICIO']),
            periodo_fim: uiPeriodoFim || parseDateToDB(row['PERIODO_FIM'] || row['PERIODO FIM']),
            referencia: refNumber,
            liberado_pagamento: true,
          }
        })

        window.dispatchEvent(new Event('import-start'))

        const CHUNK_SIZE = 100
        const totalChunks = Math.ceil(formattedData.length / CHUNK_SIZE)
        let totalImported = 0
        const allErrors: string[] = []
        let failedBatch = -1
        let lastErrorMsg = ''

        for (let i = 0; i < totalChunks; i++) {
          const chunk = formattedData.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
          try {
            const res = await pb.send('/backend/v1/import/colaboradores', {
              method: 'POST',
              body: {
                data: chunk,
                dataLiberacao,
                periodoInicio,
                periodoFim,
                referencia: refNumber,
              },
            })

            if (res.errors && res.errors.length > 0) {
              allErrors.push(...res.errors)
            }
            totalImported += res.count || 0
          } catch (chunkErr: any) {
            console.error('[ImportPlanilha] Erro na requisição do lote', i + 1, ':', chunkErr)
            console.error(
              '[ImportPlanilha] Resposta completa do erro:',
              chunkErr?.response || chunkErr,
            )
            failedBatch = i + 1
            const status = chunkErr.status || 0
            const apiMsg = chunkErr.response?.message || chunkErr.message || 'Falha na requisição'
            lastErrorMsg = status > 0 ? `(${status}) ${apiMsg}` : apiMsg
            allErrors.push(`Lote ${failedBatch}: ${lastErrorMsg}`)
            break
          }
          setProgress(Math.round(((i + 1) / totalChunks) * 100))
        }

        const hasFailure = failedBatch !== -1

        if (hasFailure) {
          allErrors.unshift(
            `Importação interrompida no lote ${failedBatch}.${totalImported > 0 ? ` ${totalImported} registros foram importados antes da falha.` : ''} Erro: ${lastErrorMsg}`,
          )
        }

        if (allErrors.length > 0) {
          setImportErrors(allErrors)
        }

        if (!hasFailure && totalImported > 0 && allErrors.length === 0) {
          toast.success(`${totalImported} registros importados com sucesso`)
          onOpenChange(false)
          setFile(null)
          setProgress(0)
          setImportErrors([])
          const d = new Date()
          setDataLiberacao(
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
          )
        } else if (!hasFailure && allErrors.length === 0 && totalImported === 0) {
          setImportErrors([
            'Nenhum registro foi importado. Verifique os dados da planilha e tente novamente.',
          ])
        }
      } catch (error: any) {
        console.error('[ImportPlanilha] Erro geral na importação:', error)
        console.error('[ImportPlanilha] Resposta completa do erro:', error?.response || error)
        const errorMsg = error.response?.message || error.message || 'Erro desconhecido'
        const isValidationError = errorMsg.includes('Arquivo invalido')
        setImportErrors([isValidationError ? errorMsg : `Erro ao importar: ${errorMsg}`])
      } finally {
        window.dispatchEvent(new Event('import-end'))
        setLoading(false)
        setProgress(0)
      }
    }

    if (!(window as any).XLSX) {
      const script = document.createElement('script')
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
      script.onload = processFile
      script.onerror = () => {
        console.error('[ImportPlanilha] Falha ao carregar biblioteca XLSX')
        setImportErrors(['Erro ao carregar dependência para leitura de planilhas.'])
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
        if (loading) return
        onOpenChange(val)
        if (!val) {
          setFile(null)
          setConfirming(false)
          setDataLiberacao('')
          setPeriodoInicio('')
          setPeriodoFim('')
          setReferencia('')
          setProgress(0)
          setImportErrors([])
          setCopied(false)
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

        {importErrors.length > 0 && (
          <div className="w-full rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-4 animate-fade-in-up">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
                <span className="text-sm font-semibold text-rose-800 dark:text-rose-200">
                  {importErrors.length}{' '}
                  {importErrors.length === 1 ? 'erro encontrado' : 'erros encontrados'}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyErrors}
                className="shrink-0 gap-1.5 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copiar Erros
                  </>
                )}
              </Button>
            </div>
            <ScrollArea className="h-48 w-full rounded-md bg-white dark:bg-background border border-rose-100 dark:border-rose-900/50">
              <div className="p-3 space-y-1.5">
                {importErrors.map((err, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300 leading-relaxed"
                  >
                    <span className="font-bold text-rose-500 dark:text-rose-400 shrink-0 min-w-[2rem]">
                      {idx + 1}.
                    </span>
                    <span className="break-words">{err}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

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
                    setImportErrors([])
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 w-full text-left my-2">
                <div className="space-y-2">
                  <Label htmlFor="dataLiberacao" className="flex gap-1">
                    Liberação <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="dataLiberacao"
                    type="date"
                    value={dataLiberacao}
                    onChange={(e) => setDataLiberacao(e.target.value)}
                    disabled={loading || confirming}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="periodoInicio" className="flex gap-1">
                    Início Ref. <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="periodoInicio"
                    type="date"
                    value={periodoInicio}
                    onChange={(e) => setPeriodoInicio(e.target.value)}
                    disabled={loading || confirming}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="periodoFim" className="flex gap-1">
                    Fim Ref. <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="periodoFim"
                    type="date"
                    value={periodoFim}
                    onChange={(e) => setPeriodoFim(e.target.value)}
                    disabled={loading || confirming}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="referencia" className="flex gap-1">
                    Referência <span className="text-rose-500">*</span>
                  </Label>
                  <Input
                    id="referencia"
                    type="number"
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                    disabled={loading || confirming}
                  />
                </div>
              </div>

              {!confirming ? (
                <div className="w-full space-y-2">
                  <Button
                    onClick={() => setConfirming(true)}
                    disabled={
                      loading || !dataLiberacao || !periodoInicio || !periodoFim || !referencia
                    }
                    className="w-full"
                  >
                    Verificar Importação
                  </Button>
                  {(!dataLiberacao || !periodoInicio || !periodoFim || !referencia) && (
                    <p className="text-xs text-center text-muted-foreground">
                      Preencha os campos obrigatórios para continuar.
                    </p>
                  )}
                </div>
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
                        <span className="flex items-center gap-2 justify-center">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Importando...
                        </span>
                      ) : (
                        'Sim, importar'
                      )}
                    </Button>
                  </div>
                  {loading && progress > 0 && (
                    <div className="mt-4 space-y-2 animate-fade-in-up w-full">
                      <div className="flex justify-between text-xs text-muted-foreground px-1">
                        <span>Progresso da importação</span>
                        <span>{progress}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                  )}
                </div>
              )}

              {importErrors.length > 0 && (
                <div className="w-full flex justify-center mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUpload}
                    disabled={loading}
                    className="gap-1.5"
                  >
                    Tentar Novamente
                  </Button>
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
