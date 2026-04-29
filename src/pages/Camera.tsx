import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Camera as CameraIcon,
  CheckCircle2,
  ScanFace,
  XCircle,
  RefreshCw,
  User,
  Image as ImageIcon,
} from 'lucide-react'
import { getColaboradorByRegistro } from '@/services/colaboradores'
import { createPagamento } from '@/services/pagamentos'
import { mockRecognizeFace } from '@/services/reconhecimento-facial'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'

type Status = 'idle' | 'loading' | 'success' | 'error'

export default function Camera() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [status, setStatus] = useState<Status>('idle')
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [colaborador, setColaborador] = useState<any>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [isConfirming, setIsConfirming] = useState(false)
  const [isInitializingCamera, setIsInitializingCamera] = useState(true)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let stream: MediaStream | null = null
    let isMounted = true

    const startCamera = async () => {
      if (!videoRef.current) return

      try {
        setIsInitializingCamera(true)
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
          })
        } catch (initialErr: any) {
          if (
            initialErr.name === 'OverconstrainedError' ||
            initialErr.name === 'ConstraintNotSatisfiedError'
          ) {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: 'user' },
            })
          } else {
            throw initialErr
          }
        }

        if (isMounted && videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => {
            if (isMounted) setIsInitializingCamera(false)
          }
        } else if (stream) {
          stream.getTracks().forEach((track) => track.stop())
        }
      } catch (err: any) {
        console.error('Camera initialization error', err)
        if (!isMounted) return

        const errorName = err?.name || ''
        if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
          setErrorMsg('Câmera em uso por outro aplicativo')
        } else if (errorName === 'NotAllowedError' || errorName === 'SecurityError') {
          setErrorMsg('Permissão de câmera negada')
        } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
          setErrorMsg('Hardware de vídeo não encontrado')
        } else {
          setErrorMsg('Erro ao inicializar câmera')
        }
        setStatus('error')
        setIsInitializingCamera(false)
      }
    }

    if (status === 'idle') {
      startCamera()
    }

    return () => {
      isMounted = false
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [status])

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')

    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const imageBase64 = canvas.toDataURL('image/jpeg', 0.8)
      setCapturedImage(imageBase64)
      processRecognition(imageBase64)
    }
  }

  const processRecognition = async (imageBase64: string) => {
    setStatus('loading')
    try {
      const registro = await mockRecognizeFace(imageBase64)
      const colab = await getColaboradorByRegistro(registro)
      setColaborador(colab)
      setStatus('success')
    } catch (err) {
      console.error(err)
      setErrorMsg('Colaborador não encontrado ou erro no reconhecimento facial.')
      setStatus('error')
    }
  }

  const handleConfirmPayment = async () => {
    if (!colaborador) return
    setIsConfirming(true)
    try {
      await createPagamento({
        colaborador_id: colaborador.id,
        valor_pago: colaborador.valor_a_receber,
        data_pagamento: new Date().toISOString(),
      })

      toast({
        title: 'Pagamento Confirmado',
        description: `O pagamento para ${colaborador.nome} foi registrado com sucesso.`,
      })

      resetFlow()
    } catch (err) {
      toast({
        title: 'Erro ao confirmar',
        description: 'Não foi possível registrar o pagamento.',
        variant: 'destructive',
      })
    } finally {
      setIsConfirming(false)
    }
  }

  const resetFlow = () => {
    setCapturedImage(null)
    setColaborador(null)
    setErrorMsg('')
    setStatus('idle')
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
  }

  const fotoUrl = colaborador?.foto ? pb.files.getURL(colaborador, colaborador.foto) : null

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4 flex flex-col items-center">
      <div className="w-full text-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Autenticação Facial</h1>
        <p className="text-slate-500 mt-2">Boca de Caixa: {user?.name}</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 w-full max-w-5xl">
        {/* Left Column: Camera / Skeletons / Captured Image */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="relative w-full aspect-video bg-slate-950 rounded-2xl overflow-hidden shadow-xl border border-slate-800 flex items-center justify-center">
            {status === 'idle' && (
              <>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`absolute inset-0 w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-300 ${isInitializingCamera ? 'opacity-0' : 'opacity-100'}`}
                />
                {isInitializingCamera && (
                  <Skeleton className="absolute inset-0 w-full h-full rounded-2xl" />
                )}
                {!isInitializingCamera && (
                  <div className="absolute inset-0 border-[6px] border-transparent border-t-emerald-500/50 border-b-emerald-500/50 rounded-2xl pointer-events-none opacity-50" />
                )}
              </>
            )}

            {status === 'loading' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 z-10">
                <ScanFace size={64} className="mb-4 text-emerald-500 animate-pulse" />
                <p className="text-lg font-medium tracking-widest uppercase text-emerald-500 animate-pulse">
                  Processando Face...
                </p>
              </div>
            )}

            {(status === 'success' || status === 'error') && capturedImage && (
              <img
                src={capturedImage}
                alt="Captured"
                className={`absolute inset-0 w-full h-full object-cover transform scale-x-[-1] transition-all duration-500 ${status === 'error' ? 'grayscale opacity-50' : ''}`}
              />
            )}

            {status === 'error' && !capturedImage && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-10">
                <XCircle size={64} className="mb-4 text-red-500" />
                <p className="text-lg font-medium text-slate-400">Sem sinal de vídeo</p>
              </div>
            )}

            {/* Hidden canvas for capturing */}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {status === 'idle' && (
            <Button
              size="lg"
              disabled={isInitializingCamera}
              className="w-full h-14 text-lg bg-blue-600 hover:bg-blue-700 transition-all active:scale-[0.98] disabled:opacity-50"
              onClick={capturePhoto}
            >
              <CameraIcon className="mr-2 h-6 w-6" />
              Capturar Foto
            </Button>
          )}

          {status === 'error' && (
            <Button
              size="lg"
              variant="destructive"
              className="w-full h-14 text-lg transition-all active:scale-[0.98]"
              onClick={resetFlow}
            >
              <RefreshCw className="mr-2 h-5 w-5" />
              Tentar Novamente
            </Button>
          )}
        </div>

        {/* Right Column: Information / Actions */}
        <div className="flex-1 flex flex-col gap-6 w-full lg:max-w-[400px]">
          {status === 'idle' && (
            <>
              <Card className="border-slate-200 dark:border-slate-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ScanFace className="h-5 w-5 text-blue-500" />
                    Instruções
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600 dark:text-slate-400">
                    Posicione o rosto do colaborador centralizado na câmera e clique em{' '}
                    <strong>'Capturar Foto'</strong> para iniciar o reconhecimento facial e
                    verificar pendências de pagamento.
                  </p>
                </CardContent>
              </Card>
              <Button
                disabled
                size="lg"
                className="w-full h-14 text-lg bg-emerald-600/50 cursor-not-allowed"
              >
                Confirmar Pagamento
              </Button>
            </>
          )}

          {status === 'loading' && (
            <div className="space-y-4">
              <Skeleton className="h-[200px] w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-md" />
            </div>
          )}

          {status === 'success' && colaborador && (
            <div className="animate-fade-in-up space-y-6">
              <Card className="border-emerald-500/50 shadow-lg shadow-emerald-500/10 overflow-hidden">
                <div className="bg-emerald-50 dark:bg-emerald-950/30 px-6 py-4 border-b border-emerald-100 dark:border-emerald-900/50 flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  <h3 className="font-semibold text-emerald-800 dark:text-emerald-400">
                    Identificação Confirmada
                  </h3>
                </div>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="h-20 w-20 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-700 shadow-md flex items-center justify-center overflow-hidden shrink-0">
                      {fotoUrl ? (
                        <img
                          src={fotoUrl}
                          alt={colaborador.nome}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="h-10 w-10 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">
                        Colaborador
                      </p>
                      <h2
                        className="text-xl font-bold text-slate-900 dark:text-white truncate"
                        title={colaborador.nome}
                      >
                        {colaborador.nome}
                      </h2>
                      <p className="text-slate-500 text-sm mt-1">
                        Reg: {colaborador.registro} • {colaborador.filial}
                      </p>
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-2">
                      Valor Pendente
                    </p>
                    <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(colaborador.valor_a_receber)}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-4">
                <Button
                  size="lg"
                  variant="outline"
                  className="flex-1 h-14"
                  onClick={resetFlow}
                  disabled={isConfirming}
                >
                  Cancelar
                </Button>
                <Button
                  size="lg"
                  className="flex-1 h-14 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleConfirmPayment}
                  disabled={isConfirming || colaborador.valor_a_receber <= 0}
                >
                  {isConfirming ? (
                    <RefreshCw className="h-5 w-5 animate-spin" />
                  ) : (
                    'Confirmar Pagamento'
                  )}
                </Button>
              </div>
            </div>
          )}

          {status === 'error' && (
            <Card className="border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20">
              <CardHeader>
                <CardTitle className="text-red-700 dark:text-red-400 flex items-center gap-2">
                  <XCircle className="h-5 w-5" />
                  Falha na Identificação
                </CardTitle>
                <CardDescription className="text-red-600/80 dark:text-red-400/80">
                  {errorMsg}
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
