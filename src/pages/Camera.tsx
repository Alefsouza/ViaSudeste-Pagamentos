import { useState, useRef, useEffect, useCallback } from 'react'
import pb from '@/lib/pocketbase/client'
import { getColaboradorByRegistro, updateColaborador } from '@/services/colaboradores'
import { reconhecimentoFacialService } from '@/services/reconhecimento-facial'
import { createPagamento, updatePagamento } from '@/services/pagamentos'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Loader2,
  Search,
  Camera as CameraIcon,
  CheckCircle2,
  AlertCircle,
  RefreshCcw,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/hooks/use-auth'
import { cn } from '@/lib/utils'

type ViewState =
  | 'EMPTY'
  | 'SEARCHING'
  | 'SEARCH_FAILED'
  | 'CAPTURING'
  | 'PROCESSING'
  | 'RECOGNITION_SUCCESS'
  | 'RECOGNITION_FAILED'
  | 'CONFIRMING_PAYMENT'

export default function Camera() {
  const [registro, setRegistro] = useState('')
  const [viewState, setViewState] = useState<ViewState>('EMPTY')
  const [colaborador, setColaborador] = useState<any>(null)
  const [fotoPredeterminada, setFotoPredeterminada] = useState<string | null>(null)
  const [fotoCapturada, setFotoCapturada] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [streamActive, setStreamActive] = useState(false)

  const { toast } = useToast()
  const { user } = useAuth()

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
      setStreamActive(false)
    }
  }, [])

  const startCamera = useCallback(async () => {
    if (videoRef.current && videoRef.current.srcObject) return
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setStreamActive(true)
      }
    } catch (err) {
      setErrorMsg('Câmera não encontrada. Verifique se está conectada')
    }
  }, [])

  const isCameraActive = [
    'CAPTURING',
    'PROCESSING',
    'RECOGNITION_SUCCESS',
    'RECOGNITION_FAILED',
    'CONFIRMING_PAYMENT',
  ].includes(viewState)

  useEffect(() => {
    if (isCameraActive) {
      startCamera()
    } else {
      stopCamera()
    }
  }, [isCameraActive, startCamera, stopCamera])

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()

    setViewState('SEARCHING')
    setErrorMsg(null)
    setColaborador(null)
    setFotoPredeterminada(null)
    setFotoCapturada(null)

    try {
      const result = await getColaboradorByRegistro(registro)
      if (!result || !result.colab) {
        const msg = 'Todos os pagamentos deste colaborador estão em dia.'
        setViewState('SEARCH_FAILED')
        setErrorMsg(msg)
        toast({
          title: 'Aviso',
          description: msg,
          variant: 'destructive',
        })
        return
      }

      setColaborador(result.colab)
      setFotoPredeterminada(result.fotoUrl)
      setViewState('CAPTURING')
    } catch (err: any) {
      setViewState('SEARCH_FAILED')
      const msg = err.message || 'Todos os pagamentos deste colaborador estão em dia.'
      setErrorMsg(msg)
      toast({
        title: 'Aviso',
        description: msg,
        variant: 'destructive',
      })
    }
  }

  const formatDateSafe = (dStr?: string) => {
    if (!dStr) return 'Data não informada'
    const match = dStr.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) return `${match[3]}/${match[2]}/${match[1]}`
    const d = new Date(dStr)
    if (!isNaN(d.getTime())) return d.toLocaleDateString('pt-BR')
    return dStr
  }

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '--:--'
    if (timeStr.length === 4 && !timeStr.includes(':')) {
      return `${timeStr.substring(0, 2)}:${timeStr.substring(2, 4)}`
    }
    if (timeStr.includes('T') || timeStr.includes(' ')) {
      const date = new Date(timeStr)
      if (!isNaN(date.getTime())) {
        return date.toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      }
    }
    const parts = timeStr.split(':')
    if (parts.length >= 2) return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`
    return timeStr
  }

  const formatHoras = (horas?: number | string) => {
    if (horas === undefined || horas === null || horas === '') return '00.00'
    const num = typeof horas === 'string' ? parseFloat(horas) : horas
    if (isNaN(num)) return '00.00'
    return num.toFixed(2).padStart(5, '0')
  }

  const getTipoPagamentoDesc = (idtipopgto?: number | string) => {
    const id = typeof idtipopgto === 'string' ? parseInt(idtipopgto, 10) : idtipopgto
    switch (id) {
      case 1:
        return 'Hora Extra'
      case 3:
        return 'Ferias Trabalhada'
      case 4:
        return 'Vale Refeicao'
      default:
        return 'Tipo desconhecido'
    }
  }

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current || !fotoPredeterminada) return

    setViewState('PROCESSING')
    setErrorMsg(null)

    setTimeout(async () => {
      try {
        const video = videoRef.current
        const canvas = canvasRef.current
        if (!video || !canvas) return

        const context = canvas.getContext('2d')
        if (!context) return

        canvas.width = 360
        canvas.height = 360

        const size = Math.min(video.videoWidth, video.videoHeight)
        const startX = (video.videoWidth - size) / 2
        const startY = (video.videoHeight - size) / 2

        context.drawImage(video, startX, startY, size, size, 0, 0, 360, 360)

        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/jpeg', 0.5),
        )
        if (!blob) throw new Error('Falha na compressão da imagem')

        const fotoCaptured = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
        setFotoCapturada(fotoCaptured)

        const success = await reconhecimentoFacialService(
          fotoPredeterminada,
          fotoCaptured,
          colaborador?.registro,
        )

        if (success) {
          setViewState('RECOGNITION_SUCCESS')
          setErrorMsg(null)
        } else {
          setViewState('RECOGNITION_FAILED')
          setErrorMsg('Rosto não corresponde ao registro informado')
        }
      } catch (err: any) {
        setViewState('RECOGNITION_FAILED')
        if (
          err.message &&
          err.message !== 'Unknown error' &&
          err.message !== 'Something went wrong.'
        ) {
          setErrorMsg(err.message)
        } else if (err.status === 401) {
          setErrorMsg('Credenciais da AWS inválidas. Verifique Secrets')
        } else if (err.status === 403) {
          setErrorMsg('Região da AWS inválida. Verifique Secrets')
        } else if (err.status === 429) {
          setErrorMsg('Limite de requisições atingido. Tente novamente')
        } else if (err.status === 504) {
          setErrorMsg('Timeout ao processar reconhecimento. Tente novamente')
        } else if (err.status === 500) {
          setErrorMsg('Serviço da AWS indisponível. Tente novamente')
        } else {
          setErrorMsg('Erro ao processar foto. Tente capturar novamente')
        }
      }
    }, 10)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
  }

  const handleConfirmPayment = async () => {
    if (!colaborador) return

    if (!fotoCapturada) {
      toast({
        title: 'Erro',
        description: 'Nenhuma foto capturada encontrada. Tente novamente',
        variant: 'destructive',
      })
      setViewState('RECOGNITION_SUCCESS')
      return
    }

    setViewState('CONFIRMING_PAYMENT')
    let file: File | undefined

    try {
      const response = await fetch(fotoCapturada)
      const blob = await response.blob()
      const timestamp = Date.now()
      const fileName = `${colaborador.registro}_${timestamp}.jpg`
      file = new File([blob], fileName, { type: 'image/jpeg' })
    } catch (error) {
      console.error('Erro ao converter foto capturada:', error)
    }

    if (!file) {
      toast({
        title: 'Erro',
        description: 'Erro ao processar foto capturada. Tente novamente',
        variant: 'destructive',
      })
      setViewState('RECOGNITION_SUCCESS')
      return
    }

    const now = new Date()
    const data_pagamento = now.toISOString()
    const hora_pagamento = now.toLocaleTimeString('pt-BR', { hour12: false })

    try {
      let firstFileUrl = ''

      const recordsToProcess =
        colaborador.records && colaborador.records.length > 0 ? colaborador.records : [colaborador]

      for (let i = 0; i < recordsToProcess.length; i++) {
        const record = recordsToProcess[i]

        const parsedHoras =
          typeof record.horas === 'string' ? parseFloat(record.horas) : record.horas
        const validHoras =
          typeof parsedHoras === 'number' && !isNaN(parsedHoras) ? parsedHoras : undefined

        const parsedIdTipoPgto =
          typeof record.idtipopgto === 'string'
            ? parseInt(record.idtipopgto, 10)
            : record.idtipopgto
        const validIdTipoPgto =
          typeof parsedIdTipoPgto === 'number' && !isNaN(parsedIdTipoPgto)
            ? parsedIdTipoPgto
            : undefined

        const dataToSave: any = {
          colaborador_id: record.id,
          valor_pago: record.valor_a_receber || record.valor || 0,
          data_pagamento,
          hora_pagamento,
          user_id: user?.id,
          status: 'Confirmado',
          inicio: record.inicio,
          termino: record.termino,
          horas: validHoras,
          idtipopgto: validIdTipoPgto,
          tipo_pagamento: getTipoPagamentoDesc(record.idtipopgto),
          registro: record.registro,
          nome: record.nome,
          filial: record.filial_id ? Number(record.filial_id) : undefined,
        }

        if (i === 0) {
          dataToSave.foto_confirmacao = file
        } else if (firstFileUrl) {
          dataToSave.foto_confirmacao_url = firstFileUrl
        }

        const pagamentoRecord = await createPagamento(dataToSave)

        if (i === 0) {
          firstFileUrl = pb.files.getURL(pagamentoRecord, pagamentoRecord.foto_confirmacao)
          await updatePagamento(pagamentoRecord.id, { foto_confirmacao_url: firstFileUrl })
        }
      }

      try {
        if (colaborador.all_records_ids && Array.isArray(colaborador.all_records_ids)) {
          for (const id of colaborador.all_records_ids) {
            await updateColaborador(id, { foto_confirmacao_url: firstFileUrl })
          }
        } else {
          await updateColaborador(colaborador.id, { foto_confirmacao_url: firstFileUrl })
        }
      } catch (err) {
        toast({
          title: 'Aviso',
          description: 'Pagamento confirmado, mas erro ao atualizar colaborador(es).',
          variant: 'destructive',
        })
        handleReset()
        return
      }

      toast({
        title: 'Sucesso',
        description: `Pagamento confirmado para ${colaborador.nome} no valor de ${formatCurrency(
          colaborador.valor_a_receber || colaborador.valor || 0,
        )}`,
      })
      handleReset()
    } catch (err) {
      console.error(err)
      toast({
        title: 'Erro',
        description: 'Erro ao confirmar pagamento. Tente novamente',
        variant: 'destructive',
      })
      setViewState('RECOGNITION_SUCCESS')
    }
  }

  const handleReset = () => {
    setRegistro('')
    setColaborador(null)
    setFotoPredeterminada(null)
    setFotoCapturada(null)
    setErrorMsg(null)
    setViewState('EMPTY')
  }

  const handleRetry = () => {
    setColaborador(null)
    setFotoPredeterminada(null)
    setFotoCapturada(null)
    setErrorMsg(null)
    setViewState('EMPTY')
  }

  return (
    <div className="container max-w-5xl mx-auto p-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Pagamento de Boca de Caixa
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Identifique o colaborador e realize a verificação facial.
        </p>
      </div>

      <div className="grid md:grid-cols-12 gap-4 h-auto md:h-[513px]">
        {/* Left Column */}
        <div className="md:col-span-5 h-full">
          <div className="flex flex-col gap-4 h-full">
            <Card className="shrink-0 border-slate-200 dark:border-slate-800 shadow-sm rounded-xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Busca de Funcionário</CardTitle>
                <CardDescription>Insira o número de registro para localizar.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSearch} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="registro" className="text-slate-700 dark:text-slate-300">
                      Registro
                    </Label>
                    <Input
                      id="registro"
                      placeholder="Ex: 12345"
                      value={registro}
                      onChange={(e) => setRegistro(e.target.value)}
                      className="border-slate-200 dark:border-slate-800"
                      disabled={
                        viewState !== 'EMPTY' &&
                        viewState !== 'SEARCH_FAILED' &&
                        viewState !== 'RECOGNITION_FAILED'
                      }
                    />
                  </div>
                  {(viewState === 'SEARCH_FAILED' || errorMsg) && (
                    <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/10 dark:text-red-400 p-3 rounded-md">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span className="leading-snug">
                        {viewState === 'SEARCH_FAILED' && !errorMsg
                          ? 'Todos os pagamentos deste colaborador estão em dia.'
                          : errorMsg}
                      </span>
                    </div>
                  )}
                  {viewState === 'SEARCH_FAILED' ? (
                    <Button
                      type="button"
                      className="w-full bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-50 dark:text-slate-900 h-10"
                      onClick={handleRetry}
                    >
                      Tentar Novamente
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      className="w-full bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-50 dark:text-slate-900 h-10"
                      disabled={viewState === 'SEARCHING' || viewState === 'PROCESSING'}
                    >
                      {viewState === 'SEARCHING' ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Buscando...
                        </>
                      ) : (
                        <>
                          <Search className="mr-2 h-4 w-4" />
                          Buscar
                        </>
                      )}
                    </Button>
                  )}
                  {viewState !== 'EMPTY' &&
                    viewState !== 'SEARCHING' &&
                    viewState !== 'SEARCH_FAILED' && (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full h-10 mt-2 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800"
                        onClick={handleReset}
                        disabled={viewState === 'PROCESSING'}
                      >
                        Nova Busca
                      </Button>
                    )}
                </form>
              </CardContent>
            </Card>

            {colaborador && (
              <Card className="shrink-0 border-slate-200 dark:border-slate-800 shadow-sm rounded-xl animate-in fade-in duration-300">
                <CardHeader className="pb-3">
                  <CardTitle className="text-md">Perfil</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    {fotoPredeterminada ? (
                      <div className="w-14 h-14 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800 shrink-0">
                        <img
                          src={fotoPredeterminada}
                          alt="Foto"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                        <CameraIcon className="h-5 w-5 text-slate-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900 dark:text-white truncate">
                        {colaborador.nome}
                      </p>
                      <p className="text-sm text-slate-500">Reg: {colaborador.registro}</p>
                      <p className="text-sm text-slate-500">{colaborador.filial}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Right Column - Camera */}
        <div className="md:col-span-7 h-full min-h-[400px] md:min-h-0">
          <Card className="h-full relative overflow-hidden border-slate-200 dark:border-slate-800 shadow-sm rounded-xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
            {isCameraActive && !streamActive && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-100 dark:bg-slate-900">
                <Loader2 className="h-8 w-8 text-slate-400 animate-spin" />
              </div>
            )}

            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={cn(
                'absolute inset-0 w-full h-full object-cover transition-opacity duration-300',
                isCameraActive ? 'opacity-100' : 'opacity-0',
              )}
            />
            <canvas ref={canvasRef} className="hidden" />

            {(!isCameraActive ||
              viewState === 'EMPTY' ||
              viewState === 'SEARCHING' ||
              viewState === 'SEARCH_FAILED') && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-500">
                <CameraIcon className="h-8 w-8 mb-4 text-slate-400" />
                <p className="text-sm">A câmera será ativada após a busca.</p>
              </div>
            )}

            {viewState === 'PROCESSING' && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm">
                <Loader2 className="h-8 w-8 text-slate-900 dark:text-white animate-spin mb-4" />
                <p className="text-sm font-medium text-slate-900 dark:text-white">Processando...</p>
              </div>
            )}

            {(viewState === 'RECOGNITION_SUCCESS' || viewState === 'CONFIRMING_PAYMENT') && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 dark:bg-slate-950/90 backdrop-blur-sm">
                {viewState === 'CONFIRMING_PAYMENT' ? (
                  <>
                    <Loader2 className="h-8 w-8 text-slate-900 dark:text-white animate-spin mb-4" />
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      Confirmando pagamento...
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-4">
                      <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-500" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 dark:text-white">
                      Reconhecimento Concluído
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">Verifique os dados no resumo.</p>
                  </>
                )}
              </div>
            )}

            {viewState === 'RECOGNITION_FAILED' && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 dark:bg-slate-950/90 backdrop-blur-sm px-6 text-center">
                <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
                  <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-500" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                  Reconhecimento Falhou
                </h3>
                <p className="text-sm text-slate-500 mb-6">
                  {errorMsg || 'Rosto não corresponde ao registro.'}
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setViewState('CAPTURING')
                    setErrorMsg(null)
                  }}
                >
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Tentar Novamente
                </Button>
              </div>
            )}

            {viewState === 'CAPTURING' && (
              <div className="absolute inset-0 z-10 flex flex-col justify-end p-6">
                <div className="flex justify-center">
                  <Button
                    size="lg"
                    className="rounded-full h-16 w-16 p-0 border border-slate-200 bg-white/90 hover:bg-white text-slate-900 shadow-sm backdrop-blur-sm transition-all"
                    onClick={handleCapture}
                  >
                    <CameraIcon className="h-6 w-6" />
                    <span className="sr-only">Capturar Foto</span>
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Resumo Modal */}
      <Dialog
        open={viewState === 'RECOGNITION_SUCCESS' || viewState === 'CONFIRMING_PAYMENT'}
        onOpenChange={(open) => {
          if (!open && viewState !== 'CONFIRMING_PAYMENT') handleReset()
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Resumo do Pagamento</DialogTitle>
            <DialogDescription>
              Confirme os detalhes do pagamento para o colaborador identificado.
            </DialogDescription>
          </DialogHeader>

          {colaborador && (
            <div className="space-y-6 mt-4">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900 p-4 rounded-lg">
                <div>
                  <p className="text-sm text-slate-500">Registro</p>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {colaborador.registro}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500">Nome</p>
                  <p className="font-medium text-slate-900 dark:text-white">{colaborador.nome}</p>
                </div>
              </div>

              <div className="border rounded-md overflow-x-auto">
                <Table className="min-w-[600px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Registro</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Término</TableHead>
                      <TableHead>Tipo de Pagamento</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(colaborador.records && colaborador.records.length > 0
                      ? colaborador.records
                      : [colaborador]
                    ).map((record: any, idx: number) => (
                      <TableRow key={record.id || idx}>
                        <TableCell>{record.registro}</TableCell>
                        <TableCell>{record.nome}</TableCell>
                        <TableCell>
                          {formatDateSafe(record.data)} {formatTime(record.inicio)}
                        </TableCell>
                        <TableCell>
                          {formatDateSafe(record.data)} {formatTime(record.termino)}
                        </TableCell>
                        <TableCell>{getTipoPagamentoDesc(record.idtipopgto)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(record.valor_a_receber || record.valor || 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end">
                <div className="w-full md:w-1/2 space-y-3">
                  <div className="border-b pb-3 space-y-2">
                    <h4 className="font-medium text-sm text-slate-700 dark:text-slate-300">
                      Subtotais por Tipo
                    </h4>
                    {Object.entries(
                      (colaborador.records && colaborador.records.length > 0
                        ? colaborador.records
                        : [colaborador]
                      ).reduce((acc: any, record: any) => {
                        const type = getTipoPagamentoDesc(record.idtipopgto)
                        const val = record.valor_a_receber || record.valor || 0
                        acc[type] = (acc[type] || 0) + val
                        return acc
                      }, {}),
                    ).map(([type, total]: any) => (
                      <div key={type} className="flex justify-between text-sm">
                        <span className="text-slate-500">{type}</span>
                        <span className="font-medium">{formatCurrency(total)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="font-bold text-lg">Total Geral</span>
                    <span className="font-bold text-xl text-green-600 dark:text-green-500">
                      {formatCurrency(colaborador.valor_a_receber || colaborador.valor || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={viewState === 'CONFIRMING_PAYMENT'}
            >
              Cancelar
            </Button>
            <Button onClick={handleConfirmPayment} disabled={viewState === 'CONFIRMING_PAYMENT'}>
              {viewState === 'CONFIRMING_PAYMENT' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Confirmando...
                </>
              ) : (
                'Confirmar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
