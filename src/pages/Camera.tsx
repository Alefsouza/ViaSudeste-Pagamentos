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
} from 'lucide-react'
import { getColaboradorByRegistro } from '@/services/colaboradores'
import { createPagamento } from '@/services/pagamentos'
import { mockRecognizeFace } from '@/services/reconhecimento-facial'
import pb from '@/lib/pocketbase/client'
import { Skeleton } from '@/components/ui/skeleton'

export default function Camera() {
  const [cameraStatus, setCameraStatus] = useState<'initializing' | 'active' | 'error'>(
    'initializing',
  )
  const [cameraError, setCameraError] = useState('')

  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [capturedFile, setCapturedFile] = useState<File | null>(null)

  const [isRecognizing, setIsRecognizing] = useState(false)
  const [recognitionError, setRecognitionError] = useState<string | null>(null)

  const [colaborador, setColaborador] = useState<any>(null)
  const [isConfirming, setIsConfirming] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const { toast } = useToast()

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      })
      streamRef.current = mediaStream
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
      setCameraStatus('active')
    } catch (err: any) {
      let msg = 'Erro ao acessar a câmera.'
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg =
          'Permissão de câmera negada. Verifique as configurações do navegador e tente novamente.'
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'Câmera não encontrada. Verifique se está conectada.'
      }
      setCameraError(msg)
      setCameraStatus('error')
    }
  }

  useEffect(() => {
    startCamera()
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
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

    // Mirror image so it matches the video preview visually
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    const base64 = canvas.toDataURL('image/jpeg', 0.8)
    setCapturedImage(base64)

    canvas.toBlob(
      (blob) => {
        if (blob) {
          setCapturedFile(new File([blob], 'captura.jpg', { type: 'image/jpeg' }))
        } else {
          toast({ title: 'Erro ao capturar foto', variant: 'destructive' })
        }
      },
      'image/jpeg',
      0.8,
    )

    setIsRecognizing(true)
    setColaborador(null)
    setRecognitionError(null)

    try {
      const registro = await mockRecognizeFace(base64)
      const colab = await getColaboradorByRegistro(registro)
      setColaborador(colab)
    } catch (error) {
      setRecognitionError('Colaborador não encontrado')
    } finally {
      setIsRecognizing(false)
    }
  }

  const handleRetake = () => {
    setCapturedImage(null)
    setCapturedFile(null)
    setColaborador(null)
    setRecognitionError(null)
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
        description: 'A foto e o registro foram salvos no sistema.',
      })

      handleRetake()
    } catch (err: any) {
      toast({
        title: 'Erro ao confirmar pagamento',
        description: 'Ocorreu um erro inesperado. Verifique sua conexão.',
        variant: 'destructive',
      })
    } finally {
      setIsConfirming(false)
    }
  }

  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  const getFotoUrl = (colab: any) => {
    if (!colab || !colab.foto) return null
    return pb.files.getURL(colab, colab.foto)
  }

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4 animate-fade-in">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-6">
        Identificação Facial
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle>Câmera</CardTitle>
            <CardDescription>
              Posicione o rosto na câmera e clique em 'Capturar Foto'
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative rounded-xl overflow-hidden border-2 border-slate-200 dark:border-slate-800 bg-slate-900 aspect-[4/3] flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover transform -scale-x-100 ${
                  capturedImage ? 'hidden' : 'block'
                }`}
              />

              {capturedImage && (
                <img src={capturedImage} alt="Captura" className="w-full h-full object-cover" />
              )}

              {cameraStatus === 'error' && (
                <div className="p-6 text-center text-red-400 flex flex-col items-center">
                  <AlertCircle className="h-10 w-10 mb-2" />
                  <p className="font-medium text-lg">{cameraError}</p>
                </div>
              )}

              {cameraStatus === 'initializing' && (
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              )}

              {!capturedImage && cameraStatus === 'active' && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-[50%] h-[60%] border-4 border-dashed border-white/40 rounded-[100%] shadow-[0_0_0_9999px_rgba(0,0,0,0.3)] transition-all duration-1000" />
                </div>
              )}

              {isRecognizing && (
                <div className="absolute inset-0 bg-slate-900/80 flex flex-col items-center justify-center text-white z-10 backdrop-blur-sm">
                  <Loader2 className="h-10 w-10 animate-spin mb-4 text-blue-400" />
                  <p className="font-medium text-lg">Processando imagem...</p>
                  <p className="text-sm text-slate-300">Identificando colaborador</p>
                </div>
              )}
            </div>

            {!capturedImage ? (
              <Button
                className="w-full h-14 text-lg font-medium shadow-md hover:shadow-lg transition-all"
                size="lg"
                disabled={cameraStatus !== 'active'}
                onClick={handleCapture}
              >
                <CameraIcon className="h-6 w-6 mr-2" />
                Capturar Foto
              </Button>
            ) : (
              <Button
                variant="outline"
                className="w-full h-12"
                onClick={handleRetake}
                disabled={isConfirming || isRecognizing}
              >
                <RefreshCw className="h-5 w-5 mr-2" />
                Tentar Novamente
              </Button>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200 dark:border-slate-800">
          <CardHeader>
            <CardTitle>Resultado da Identificação</CardTitle>
            <CardDescription>
              {isRecognizing
                ? 'Aguarde o processamento...'
                : colaborador
                  ? 'Colaborador identificado com sucesso.'
                  : recognitionError
                    ? 'Falha na identificação.'
                    : 'Nenhum colaborador identificado no momento.'}
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
              <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-xl border border-red-100 dark:border-red-900/30 text-center flex flex-col items-center h-full justify-center min-h-[300px]">
                <AlertCircle className="h-12 w-12 text-red-500 mb-3" />
                <p className="text-red-700 dark:text-red-400 font-medium text-lg">
                  {recognitionError}
                </p>
              </div>
            ) : colaborador ? (
              <div className="space-y-6 animate-slide-up">
                <div className="bg-blue-50 dark:bg-blue-950/30 p-5 rounded-xl border border-blue-100 dark:border-blue-900">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <User className="h-5 w-5 text-blue-600" />
                        {colaborador.nome}
                      </h2>
                      <div className="flex items-center gap-4 mt-2 text-sm text-slate-600 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <span className="font-medium text-slate-500">Reg:</span>{' '}
                          {colaborador.registro}
                        </span>
                        <span className="flex items-center gap-1">
                          <Building className="h-4 w-4" /> {colaborador.filial}
                        </span>
                      </div>
                    </div>
                    <div className="text-right bg-white dark:bg-slate-900 p-3 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800 self-start sm:self-auto">
                      <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-1 flex items-center justify-end gap-1">
                        <DollarSign className="h-3 w-3" /> Valor a Receber
                      </div>
                      <div className="text-xl font-bold text-emerald-600">
                        {formatBRL(colaborador.valor_a_receber)}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400 text-center">
                      Foto do Sistema
                    </p>
                    <div className="aspect-[3/4] rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
                      {colaborador.foto ? (
                        <img
                          src={getFotoUrl(colaborador) || ''}
                          alt="Foto Sistema"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="h-12 w-12 text-slate-400 opacity-50" />
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400 text-center">
                      Foto Capturada
                    </p>
                    <div className="aspect-[3/4] rounded-lg overflow-hidden border-2 border-emerald-500 dark:border-emerald-600 bg-slate-100 dark:bg-slate-900 relative">
                      <img
                        src={capturedImage || ''}
                        alt="Foto Capturada"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 right-2 bg-emerald-500 text-white rounded-full p-1 shadow-md">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                    </div>
                  </div>
                </div>

                <Button
                  className="w-full h-14 text-lg font-medium bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg transition-all"
                  onClick={handleConfirm}
                  disabled={isConfirming}
                >
                  {isConfirming ? (
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="h-6 w-6 mr-2" />
                  )}
                  Confirmar Pagamento
                </Button>
              </div>
            ) : (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl p-6">
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
