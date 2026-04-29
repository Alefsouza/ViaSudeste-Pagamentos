import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import {
  Loader2,
  Camera as CameraIcon,
  User,
  Building,
  DollarSign,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  CameraOff,
  Lock,
  AlertTriangle,
} from 'lucide-react'
import { getColaboradorByRegistro } from '@/services/colaboradores'
import { createPagamento } from '@/services/pagamentos'
import { reconhecimentoFacialService } from '@/services/reconhecimento-facial'
import pb from '@/lib/pocketbase/client'
import { Skeleton } from '@/components/ui/skeleton'

type CameraErrorType = 'denied' | 'not_found' | 'in_use' | 'unsupported' | 'unknown' | 'timeout'

export default function Camera() {
  const [cameraStatus, setCameraStatus] = useState<'initializing' | 'active' | 'error'>(
    'initializing',
  )
  const [cameraError, setCameraError] = useState<{ message: string; type: CameraErrorType }>({
    message: '',
    type: 'unknown',
  })

  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [capturedFile, setCapturedFile] = useState<File | null>(null)
  const [isRecognizing, setIsRecognizing] = useState(false)
  const [recognitionError, setRecognitionError] = useState<string | null>(null)
  const [colaborador, setColaborador] = useState<any>(null)
  const [isConfirming, setIsConfirming] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const { toast } = useToast()

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }

  const startCamera = async () => {
    setCameraStatus('initializing')
    setCameraError({ message: '', type: 'unknown' })
    stopCamera()

    const constraints = { video: { facingMode: 'user' }, audio: false }
    const streamPromise = navigator.mediaDevices.getUserMedia(constraints)
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('TimeoutError')), 5000),
    )

    try {
      const mediaStream = await Promise.race([streamPromise, timeoutPromise])
      streamRef.current = mediaStream
      if (videoRef.current) videoRef.current.srcObject = mediaStream
      setCameraStatus('active')
    } catch (err: any) {
      if (err.message === 'TimeoutError') {
        streamPromise.then((s) => s.getTracks().forEach((t) => t.stop())).catch(() => {})
      }

      let msg = 'Falha ao acessar a câmera devido a um erro inesperado.'
      let type: CameraErrorType = 'unknown'

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = "Câmera bloqueada. Clique em 'Permitir' nas configurações do navegador"
        type = 'denied'
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'Câmera não encontrada. Verifique se está conectada ao dispositivo'
        type = 'not_found'
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        msg = 'A câmera está sendo usada por outro aplicativo. Feche-o e tente novamente'
        type = 'in_use'
      } else if (
        err.name === 'OverconstrainedError' ||
        err.name === 'ConstraintNotSatisfiedError'
      ) {
        msg = 'Sua câmera não suporta os requisitos necessários'
        type = 'unsupported'
      } else if (err.name === 'TypeError') {
        msg = 'Erro ao acessar a câmera. Verifique as permissões do navegador'
        type = 'unknown'
      } else if (err.message === 'TimeoutError') {
        msg = 'Tempo limite excedido ao solicitar acesso à câmera. Tente novamente.'
        type = 'timeout'
      }

      setCameraError({ message: msg, type })
      setCameraStatus('error')
    }
  }

  useEffect(() => {
    startCamera()
    return () => stopCamera()
  }, [])

  const handleCapture = async () => {
    if (!videoRef.current) return
    const video = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      toast({ title: 'Erro ao capturar foto', variant: 'destructive' })
      return
    }

    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    const base64 = canvas.toDataURL('image/jpeg', 0.8)
    setCapturedImage(base64)
    stopCamera()

    canvas.toBlob(
      (blob) => {
        if (blob) setCapturedFile(new File([blob], 'captura.jpg', { type: 'image/jpeg' }))
        else toast({ title: 'Erro ao capturar foto', variant: 'destructive' })
      },
      'image/jpeg',
      0.8,
    )

    setIsRecognizing(true)
    setColaborador(null)
    setRecognitionError(null)

    try {
      const registro = await reconhecimentoFacialService(base64)
      const colab = await getColaboradorByRegistro(registro)
      if (colab) setColaborador(colab)
      else setRecognitionError('Colaborador não encontrado')
    } catch (error) {
      setRecognitionError('Colaborador não encontrado')
    } finally {
      setIsRecognizing(false)
    }
  }

  const handleConfirm = async () => {
    if (!colaborador || !capturedFile) return
    setIsConfirming(true)
    try {
      await createPagamento({
        colaborador_id: colaborador.id,
        valor_pago: colaborador.valor_a_receber,
        data_pagamento: new Date().toISOString(),
        foto_confirmacao: capturedFile,
      })
      toast({
        title: 'Pagamento confirmado com sucesso',
        description: 'Registro salvo no sistema.',
      })
      setCapturedImage(null)
      setCapturedFile(null)
      setColaborador(null)
      setRecognitionError(null)
    } catch (err: any) {
      toast({ title: 'Erro ao confirmar pagamento', variant: 'destructive' })
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4 animate-fade-in">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-6">
        Identificação Facial
      </h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Câmera</CardTitle>
            <CardDescription>
              Posicione o rosto na câmera e clique em 'Capturar Foto'
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative rounded-xl overflow-hidden border-2 border-slate-200 dark:border-slate-800 bg-slate-900 aspect-[4/3] flex items-center justify-center">
              {cameraStatus === 'initializing' && !capturedImage && (
                <div className="absolute inset-0 z-10 bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
                  <Skeleton className="absolute inset-0 opacity-20" />
                  <Loader2 className="h-10 w-10 animate-spin text-mint mb-4 relative z-20" />
                  <p className="text-white font-medium text-lg relative z-20">
                    Solicitando acesso à câmera...
                  </p>
                </div>
              )}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transform -scale-x-100 ${capturedImage || cameraStatus !== 'active' ? 'hidden' : 'block'}`}
              />
              {capturedImage && (
                <img src={capturedImage} alt="Captura" className="w-full h-full object-cover" />
              )}
              {cameraStatus === 'error' && (
                <div className="absolute inset-0 bg-slate-900 z-10 flex flex-col items-center justify-center p-6 text-center">
                  {cameraError.type === 'denied' ? (
                    <Lock className="h-12 w-12 mb-4 text-red-500" />
                  ) : cameraError.type === 'not_found' ? (
                    <CameraOff className="h-12 w-12 mb-4 text-red-500" />
                  ) : cameraError.type === 'in_use' ? (
                    <AlertTriangle className="h-12 w-12 mb-4 text-orange-500" />
                  ) : (
                    <AlertCircle className="h-12 w-12 mb-4 text-red-500" />
                  )}
                  <p className="font-medium text-lg text-white mb-6">{cameraError.message}</p>
                  <Button onClick={startCamera} variant="secondary">
                    <RefreshCw className="h-4 w-4 mr-2" /> Tentar Novamente
                  </Button>
                </div>
              )}
              {!capturedImage && cameraStatus === 'active' && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-[50%] h-[60%] border-4 border-dashed border-white/40 rounded-[100%] shadow-[0_0_0_9999px_rgba(0,0,0,0.3)] transition-all duration-1000" />
                </div>
              )}
              {isRecognizing && (
                <div className="absolute inset-0 bg-slate-900/80 flex flex-col items-center justify-center text-white z-10 backdrop-blur-sm">
                  <Loader2 className="h-10 w-10 animate-spin mb-4 text-mint" />
                  <p className="font-medium text-lg">Processando imagem...</p>
                </div>
              )}
            </div>
            {!capturedImage ? (
              <Button
                className="w-full h-14 text-lg font-medium bg-forest hover:bg-forest/90 text-white"
                size="lg"
                disabled={cameraStatus !== 'active'}
                onClick={handleCapture}
              >
                <CameraIcon className="h-6 w-6 mr-2" /> Capturar Foto
              </Button>
            ) : (
              <Button
                variant="outline"
                className="w-full h-12 border-forest text-forest hover:bg-forest/10"
                onClick={() => {
                  setCapturedImage(null)
                  setCapturedFile(null)
                  setColaborador(null)
                  setRecognitionError(null)
                  startCamera()
                }}
                disabled={isConfirming || isRecognizing}
              >
                <RefreshCw className="h-5 w-5 mr-2" /> Descartar
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Resultado da Identificação</CardTitle>
            <CardDescription>
              {isRecognizing
                ? 'Aguarde...'
                : colaborador
                  ? 'Identificado com sucesso.'
                  : recognitionError || 'Nenhum colaborador identificado.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isRecognizing ? (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full rounded-xl" />
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="aspect-[3/4] w-full rounded-xl" />
                  <Skeleton className="aspect-[3/4] w-full rounded-xl" />
                </div>
              </div>
            ) : recognitionError ? (
              <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-xl border border-red-100 text-center flex flex-col items-center h-full justify-center min-h-[300px]">
                <AlertCircle className="h-12 w-12 text-red-500 mb-3" />
                <p className="text-red-700 dark:text-red-400 font-medium text-lg">
                  {recognitionError}
                </p>
              </div>
            ) : colaborador ? (
              <div className="space-y-6 animate-slide-up">
                <div className="bg-gradient-to-r from-mint/10 to-mint-light/10 p-5 rounded-xl border border-mint/20">
                  <div className="flex flex-col sm:flex-row justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-bold flex items-center gap-2 text-forest dark:text-mint-light">
                        <User className="h-5 w-5 text-forest dark:text-mint-light" />{' '}
                        {colaborador.nome}
                      </h2>
                      <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                        <span className="font-medium">Reg: {colaborador.registro}</span>
                        <span className="flex items-center gap-1">
                          <Building className="h-4 w-4" /> {colaborador.filial}
                        </span>
                      </div>
                    </div>
                    <div className="text-right bg-white p-3 rounded-lg shadow-sm border">
                      <div className="text-xs text-slate-500 font-medium uppercase mb-1 flex items-center justify-end gap-1">
                        <DollarSign className="h-3 w-3" /> Valor a Receber
                      </div>
                      <div className="text-xl font-bold text-forest">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(colaborador.valor_a_receber)}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-center text-slate-600">
                      Foto do Sistema
                    </p>
                    <div className="aspect-[3/4] rounded-lg overflow-hidden border bg-slate-100 flex items-center justify-center">
                      {colaborador.foto ? (
                        <img
                          src={pb.files.getURL(colaborador, colaborador.foto)}
                          alt="Sistema"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="h-12 w-12 opacity-50" />
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-center text-slate-600">Foto Capturada</p>
                    <div className="aspect-[3/4] rounded-lg overflow-hidden border-2 border-forest relative">
                      <img
                        src={capturedImage || ''}
                        alt="Capturada"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 right-2 bg-forest text-white rounded-full p-1">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                </div>
                <Button
                  className="w-full h-14 text-lg font-medium bg-forest hover:bg-forest/90 text-white"
                  onClick={handleConfirm}
                  disabled={isConfirming}
                >
                  {isConfirming ? (
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="h-6 w-6 mr-2" />
                  )}{' '}
                  Confirmar Pagamento
                </Button>
              </div>
            ) : (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-slate-400 border-2 border-dashed rounded-xl p-6">
                <User className="h-16 w-16 mb-4 opacity-20" />
                <p className="text-center font-medium">
                  Capture a foto do colaborador para ver os dados de pagamento.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
