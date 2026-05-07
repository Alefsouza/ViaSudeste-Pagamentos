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
  Loader2,
  Search,
  Camera as CameraIcon,
  CheckCircle2,
  AlertCircle,
  RefreshCcw,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

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
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [streamActive, setStreamActive] = useState(false)

  const { toast } = useToast()

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

    try {
      const result = await getColaboradorByRegistro(registro)
      if (!result.colab || !result.hasFotoRecord || !result.fotoUrl) {
        setViewState('SEARCH_FAILED')
        return
      }

      setColaborador(result.colab)
      setFotoPredeterminada(result.fotoUrl)
      setViewState('CAPTURING')
    } catch (err) {
      setViewState('SEARCH_FAILED')
    }
  }

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current || !fotoPredeterminada) return

    const startTotal = performance.now()
    let captureTime = 0,
      compressTime = 0,
      base64Time = 0,
      awsTime = 0
    let startAws = 0

    setViewState('PROCESSING')
    setErrorMsg(null)

    setTimeout(async () => {
      const startCapture = performance.now()
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
        captureTime = performance.now() - startCapture

        const startCompress = performance.now()
        const fotoCaptured = canvas.toDataURL('image/jpeg', 0.6)
        const compressTotal = performance.now() - startCompress
        compressTime = compressTotal * 0.7
        base64Time = compressTotal * 0.3

        startAws = performance.now()
        const success = await reconhecimentoFacialService(
          fotoPredeterminada,
          fotoCaptured,
          colaborador?.registro,
        )
        awsTime = performance.now() - startAws

        const totalTime = performance.now() - startTotal
        console.log(
          `Captura: ${captureTime.toFixed(0)}ms | Compressao: ${compressTime.toFixed(0)}ms | Base64: ${base64Time.toFixed(0)}ms | AWS: ${awsTime.toFixed(0)}ms | Total: ${totalTime.toFixed(0)}ms`,
        )

        if (success) {
          setViewState('RECOGNITION_SUCCESS')
          setErrorMsg(null)
        } else {
          setViewState('RECOGNITION_FAILED')
          setErrorMsg('Rosto não corresponde ao registro informado')
        }
      } catch (err: any) {
        if (startAws > 0) awsTime = performance.now() - startAws
        const totalTime = performance.now() - startTotal
        console.log(
          `Captura: ${captureTime.toFixed(0)}ms | Compressao: ${compressTime.toFixed(0)}ms | Base64: ${base64Time.toFixed(0)}ms | AWS: ${awsTime.toFixed(0)}ms | Total: ${totalTime.toFixed(0)}ms`,
        )

        setViewState('RECOGNITION_FAILED')
        if (
          err.message &&
          err.message !== 'Unknown error' &&
          err.message !== 'Something went wrong.'
        ) {
          setErrorMsg(err.message)
        } else if (err.status === 401) {
          setErrorMsg('Credenciais da AWS invalidas. Verifique Secrets')
        } else if (err.status === 403) {
          setErrorMsg('Regiao da AWS invalida. Verifique Secrets')
        } else if (err.status === 429) {
          setErrorMsg('Limite de requisicoes atingido. Tente novamente em alguns segundos')
        } else if (err.status === 504) {
          setErrorMsg('Timeout ao processar reconhecimento. Tente novamente')
        } else if (err.status === 500) {
          setErrorMsg('Servico da AWS indisponivel. Tente novamente')
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

    setViewState('CONFIRMING_PAYMENT')
    let file: File | undefined

    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      if (context) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        context.drawImage(video, 0, 0, canvas.width, canvas.height)

        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/jpeg', 0.8),
        )

        if (blob) {
          const timestamp = Date.now()
          const fileName = `${colaborador.registro}_${timestamp}.jpg`
          file = new File([blob], fileName, { type: 'image/jpeg' })
        }
      }
    }

    if (!file) {
      toast({
        title: 'Erro',
        description: 'Erro ao salvar foto. Tente novamente',
        variant: 'destructive',
      })
      setViewState('RECOGNITION_SUCCESS')
      return
    }

    const now = new Date()
    const data_pagamento = now.toISOString()
    const hora_pagamento = now.toLocaleTimeString('pt-BR', { hour12: false })

    try {
      const pagamentoRecord = await createPagamento({
        colaborador_id: colaborador.id,
        valor_pago: colaborador.valor_a_receber,
        data_pagamento,
        hora_pagamento,
        foto_confirmacao: file,
      })

      const fileUrl = pb.files.getURL(pagamentoRecord, pagamentoRecord.foto_confirmacao)
      await updatePagamento(pagamentoRecord.id, { foto_confirmacao_url: fileUrl })

      try {
        await updateColaborador(colaborador.id, { foto_confirmacao_url: fileUrl })
      } catch (err) {
        toast({
          title: 'Aviso',
          description: 'Pagamento confirmado, mas erro ao salvar foto. Contate o suporte',
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
    setErrorMsg(null)
    setViewState('EMPTY')
  }

  return (
    <div className="container max-w-4xl mx-auto p-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Pagamento de Boca de Caixa
        </h1>
        <p className="text-slate-500 mt-2">
          Identifique o colaborador e realize a verificação facial.
        </p>
      </div>

      <div className="grid md:grid-cols-12 gap-8">
        <div className="md:col-span-5 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Busca de Funcionário</CardTitle>
              <CardDescription>
                Insira o número de registro para localizar o colaborador.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="registro">Registro do Funcionário</Label>
                  <Input
                    id="registro"
                    placeholder="Ex: 12345"
                    value={registro}
                    onChange={(e) => setRegistro(e.target.value)}
                    disabled={
                      viewState !== 'EMPTY' &&
                      viewState !== 'SEARCH_FAILED' &&
                      viewState !== 'RECOGNITION_FAILED' &&
                      viewState !== 'RECOGNITION_SUCCESS'
                    }
                  />
                </div>
                {(viewState === 'SEARCH_FAILED' || errorMsg) && (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>
                      {viewState === 'SEARCH_FAILED'
                        ? 'Colaborador nao encontrado ou ja recebeu pagamento'
                        : errorMsg}
                    </span>
                  </div>
                )}
                {viewState === 'SEARCH_FAILED' ? (
                  <Button type="button" className="w-full" onClick={handleReset}>
                    Tentar Novamente
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={
                      !registro.trim() ||
                      viewState === 'SEARCHING' ||
                      viewState === 'PROCESSING' ||
                      viewState === 'CONFIRMING_PAYMENT'
                    }
                  >
                    {viewState === 'SEARCHING' ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Buscando colaborador...
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
                      className="w-full mt-2"
                      onClick={handleReset}
                      disabled={viewState === 'CONFIRMING_PAYMENT'}
                    >
                      Nova Busca
                    </Button>
                  )}{' '}
              </form>
            </CardContent>
          </Card>

          {colaborador && (
            <Card className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Perfil do Colaborador</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  {fotoPredeterminada ? (
                    <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-slate-100 dark:border-slate-800 shrink-0">
                      <img
                        src={fotoPredeterminada}
                        alt="Foto do banco"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      <CameraIcon className="h-6 w-6 text-slate-400" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 dark:text-slate-50 truncate">
                      {colaborador.nome}
                    </p>
                    <p className="text-sm text-slate-500">Garagem: {colaborador.filial}</p>
                    <p className="text-sm text-slate-500">Reg: {colaborador.registro}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="md:col-span-7">
          <Card className="h-[500px] flex flex-col overflow-hidden relative">
            {isCameraActive && (
              <div className="absolute inset-0 bg-black z-0">
                {!streamActive && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 text-white animate-spin" />
                  </div>
                )}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover transition-opacity duration-300 ${
                    viewState === 'CAPTURING' ? 'opacity-100' : 'opacity-40'
                  }`}
                />
                <canvas ref={canvasRef} className="hidden" />
              </div>
            )}

            <div className="relative z-10 flex-1 flex flex-col">
              {viewState === 'EMPTY' ||
              viewState === 'SEARCHING' ||
              viewState === 'SEARCH_FAILED' ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500 bg-white dark:bg-slate-950">
                  {' '}
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
                    <CameraIcon className="h-8 w-8 text-slate-400" />
                  </div>
                  <p>
                    A câmera será ativada automaticamente
                    <br />
                    após a busca do colaborador.
                  </p>
                </div>
              ) : viewState === 'PROCESSING' ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-white bg-black/60 backdrop-blur-sm">
                  <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                  <h3 className="text-xl font-semibold mb-2">
                    Processando reconhecimento facial...
                  </h3>
                  <p className="text-slate-300">Aguarde enquanto verificamos a identidade.</p>
                </div>
              ) : viewState === 'RECOGNITION_SUCCESS' ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in zoom-in-95 duration-300 bg-black/60 backdrop-blur-sm text-white">
                  <div className="w-20 h-20 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle2 className="h-10 w-10" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">Identidade Verificada</h3>
                  <p className="text-slate-300 mb-8">O rosto corresponde ao registro informado.</p>

                  <div className="bg-black/40 w-full max-w-sm rounded-xl p-6 mb-8 border border-white/10">
                    <p className="text-sm text-slate-400 uppercase tracking-wider font-medium mb-1">
                      Valor a Receber
                    </p>
                    <p className="text-4xl font-bold text-white">
                      {formatCurrency(colaborador?.valor_a_receber || 0)}
                    </p>
                  </div>

                  <Button
                    size="lg"
                    className="w-full max-w-sm bg-green-600 hover:bg-green-700 text-white border-0"
                    onClick={handleConfirmPayment}
                  >
                    Confirmar Pagamento
                  </Button>
                </div>
              ) : viewState === 'CONFIRMING_PAYMENT' ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-white bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
                  <Loader2 className="h-12 w-12 text-green-500 animate-spin mb-4" />
                  <h3 className="text-xl font-semibold mb-2">
                    Confirmando pagamento e salvando foto...
                  </h3>
                  <p className="text-slate-300">Aguarde um instante.</p>
                </div>
              ) : viewState === 'RECOGNITION_FAILED' ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in zoom-in-95 duration-300 bg-black/60 backdrop-blur-sm text-white">
                  <div className="w-20 h-20 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mb-6">
                    <AlertCircle className="h-10 w-10" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Reconhecimento Falhou</h3>
                  <p className="text-slate-300 mb-8 max-w-md">
                    {errorMsg || 'Rosto nao corresponde ao registro informado'}
                  </p>

                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full max-w-sm bg-transparent border-white/20 text-white hover:bg-white/10 hover:text-white"
                    onClick={() => {
                      setViewState('CAPTURING')
                      setErrorMsg(null)
                    }}
                  >
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Tentar Novamente
                  </Button>
                </div>
              ) : viewState === 'CAPTURING' ? (
                <div className="flex-1 flex flex-col">
                  <div className="flex-1 relative flex items-center justify-center">
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="w-56 h-56 md:w-72 md:h-72 border-2 border-white/50 rounded-[40px] shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"></div>
                    </div>
                  </div>
                  <div className="p-4 bg-black/80 backdrop-blur-sm border-t border-white/10 flex justify-center">
                    <Button
                      size="lg"
                      className="rounded-full h-16 w-16 p-0 border-4 border-slate-300 bg-white hover:bg-slate-200"
                      onClick={handleCapture}
                    >
                      <span className="sr-only">Capturar Foto</span>
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
