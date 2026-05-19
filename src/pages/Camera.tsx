import { useState, useRef, useEffect, useCallback } from 'react'
import pb from '@/lib/pocketbase/client'
import { getColaboradorByRegistro, updateColaborador } from '@/services/colaboradores'
import { reconhecimentoFacialService } from '@/services/reconhecimento-facial'
import {
  createPagamento,
  updatePagamento,
  updatePagamentoCompleto,
  getPagamentoByRegistro,
} from '@/services/pagamentos'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
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
    if (!registro.trim()) return

    setViewState('SEARCHING')
    setErrorMsg(null)
    setColaborador(null)
    setFotoPredeterminada(null)
    setFotoCapturada(null)

    try {
      const result = await getColaboradorByRegistro(registro)
      if (!result || !result.colab) {
        setViewState('SEARCH_FAILED')
        setErrorMsg('Colaborador não encontrado')
        return
      }

      if (!result.hasFotoRecord || !result.fotoUrl) {
        setViewState('SEARCH_FAILED')
        setErrorMsg('Foto do colaborador não encontrada')
        return
      }

      setColaborador(result.colab)
      setFotoPredeterminada(result.fotoUrl)
      setViewState('CAPTURING')
    } catch (err) {
      setViewState('SEARCH_FAILED')
      setErrorMsg('Colaborador não encontrado')
    }
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
        return 'Férias Trabalhada'
      case 4:
        return 'Vale Refeição'
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
      const pagDetails = await getPagamentoByRegistro(colaborador.registro).catch(() => null)
      const dataToSave = {
        colaborador_id: colaborador.id,
        valor_pago: colaborador.valor || colaborador.valor_a_receber,
        data_pagamento,
        hora_pagamento,
        foto_confirmacao: file,
        user_id: user?.id,
        status: 'Confirmado',
      }

      let pagamentoRecord
      if (pagDetails && pagDetails.status === 'Pendente') {
        pagamentoRecord = await updatePagamentoCompleto(pagDetails.id, dataToSave)
      } else {
        pagamentoRecord = await createPagamento(dataToSave)
      }

      const fileUrl = pb.files.getURL(pagamentoRecord, pagamentoRecord.foto_confirmacao)
      await updatePagamento(pagamentoRecord.id, { foto_confirmacao_url: fileUrl })

      try {
        await updateColaborador(colaborador.id, { foto_confirmacao_url: fileUrl })
      } catch (err) {
        toast({
          title: 'Aviso',
          description: 'Pagamento confirmado, mas erro ao atualizar colaborador.',
          variant: 'destructive',
        })
        handleReset()
        return
      }

      toast({
        title: 'Sucesso',
        description: `Pagamento confirmado para ${colaborador.nome} no valor de ${formatCurrency(
          colaborador.valor_a_receber,
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
          {viewState === 'RECOGNITION_SUCCESS' || viewState === 'CONFIRMING_PAYMENT' ? (
            <Card className="h-full flex flex-col border-slate-200 dark:border-slate-800 shadow-sm rounded-xl">
              <CardContent className="p-6 flex flex-col h-full">
                <div className="flex-1">
                  <h3 className="text-[18px] font-bold text-slate-900 dark:text-white mb-1">
                    Identidade Confirmada
                  </h3>
                  <p className="text-[12px] text-slate-500 mb-6">
                    O rosto corresponde ao registro informado.
                  </p>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="flex flex-col gap-4">
                      <div>
                        <p className="text-[12px] text-slate-500 uppercase tracking-wider font-medium mb-1">
                          Hora de Início
                        </p>
                        <p className="text-[14px] font-semibold text-slate-900 dark:text-white">
                          {formatTime(colaborador?.inicio)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[12px] text-slate-500 uppercase tracking-wider font-medium mb-1">
                          Total de Horas
                        </p>
                        <p className="text-[14px] font-semibold text-slate-900 dark:text-white">
                          {formatHoras(colaborador?.horas)}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-4">
                      <div>
                        <p className="text-[12px] text-slate-500 uppercase tracking-wider font-medium mb-1">
                          Hora de Término
                        </p>
                        <p className="text-[14px] font-semibold text-slate-900 dark:text-white">
                          {formatTime(colaborador?.termino)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[12px] text-slate-500 uppercase tracking-wider font-medium mb-1">
                          Tipo de Pagamento
                        </p>
                        <p className="text-[14px] font-semibold text-slate-900 dark:text-white">
                          {getTipoPagamentoDesc(colaborador?.idtipopgto)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-[12px] text-slate-500 uppercase tracking-wider font-medium mb-1">
                      Valor a Receber
                    </p>
                    <p className="text-[24px] font-bold text-green-600 dark:text-green-500">
                      {formatCurrency(colaborador?.valor || colaborador?.valor_a_receber || 0)}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 w-full mt-6">
                  <Button
                    variant="outline"
                    className="flex-1 h-[40px] text-slate-700 dark:text-slate-300"
                    onClick={handleReset}
                    disabled={viewState === 'CONFIRMING_PAYMENT'}
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="flex-1 h-[40px] bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-50 dark:text-slate-900"
                    onClick={handleConfirmPayment}
                    disabled={viewState === 'CONFIRMING_PAYMENT'}
                  >
                    Confirmar Pagamento
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
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
                      <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/10 dark:text-red-400 p-3 rounded-md">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>
                          {viewState === 'SEARCH_FAILED' && !errorMsg
                            ? 'Colaborador não encontrado'
                            : errorMsg}
                        </span>
                      </div>
                    )}
                    {viewState === 'SEARCH_FAILED' ? (
                      <Button
                        type="button"
                        className="w-full bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-50 dark:text-slate-900 h-10"
                        onClick={handleReset}
                      >
                        Tentar Novamente
                      </Button>
                    ) : (
                      <Button
                        type="submit"
                        className="w-full bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-50 dark:text-slate-900 h-10"
                        disabled={
                          !registro.trim() ||
                          viewState === 'SEARCHING' ||
                          viewState === 'PROCESSING'
                        }
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
          )}
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
                    <p className="text-sm text-slate-500 mt-1">Verifique os dados ao lado.</p>
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
    </div>
  )
}
