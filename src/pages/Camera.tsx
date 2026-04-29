import { useState, useRef, useEffect, useCallback } from 'react'
import { getColaboradorByRegistro } from '@/services/colaboradores'
import { reconhecimentoFacialService } from '@/services/reconhecimento-facial'
import { createPagamento } from '@/services/pagamentos'
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
  | 'CAPTURING'
  | 'PROCESSING'
  | 'RECOGNITION_SUCCESS'
  | 'RECOGNITION_FAILED'

export default function Camera() {
  const [registro, setRegistro] = useState('')
  const [viewState, setViewState] = useState<ViewState>('EMPTY')
  const [colaborador, setColaborador] = useState<any>(null)
  const [fotoDoBanco, setFotoDoBanco] = useState<string | null>(null)
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

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setStreamActive(true)
      }
    } catch (err) {
      setErrorMsg('Câmera não encontrada. Verifique se está conectada')
    }
  }

  useEffect(() => {
    if (viewState === 'CAPTURING') {
      startCamera()
    } else {
      stopCamera()
    }
    return () => stopCamera()
  }, [viewState, stopCamera])

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!registro.trim()) return

    setViewState('SEARCHING')
    setErrorMsg(null)
    setColaborador(null)
    setFotoDoBanco(null)

    try {
      const result = await getColaboradorByRegistro(registro)
      if (!result.colab) {
        setErrorMsg('Colaborador não encontrado. Verifique o registro e tente novamente')
        setViewState('EMPTY')
        return
      }

      if (!result.hasFotoRecord || !result.fotoUrl) {
        setErrorMsg('Foto não disponível para este colaborador')
        setViewState('EMPTY')
        return
      }

      setColaborador(result.colab)
      setFotoDoBanco(result.fotoUrl)
      setViewState('CAPTURING')
    } catch (err) {
      setErrorMsg('Erro ao buscar colaborador.')
      setViewState('EMPTY')
    }
  }

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current || !fotoDoBanco) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    if (!context) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    const fotoCapturada = canvas.toDataURL('image/jpeg', 0.8)

    setViewState('PROCESSING')

    try {
      const success = await reconhecimentoFacialService(fotoDoBanco, fotoCapturada)
      if (success) {
        setViewState('RECOGNITION_SUCCESS')
      } else {
        setViewState('RECOGNITION_FAILED')
      }
    } catch (err) {
      setViewState('RECOGNITION_FAILED')
      toast({
        title: 'Erro',
        description: 'Falha no serviço de reconhecimento',
        variant: 'destructive',
      })
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
  }

  const handleConfirmPayment = async () => {
    if (!colaborador) return

    try {
      await createPagamento({
        colaborador_id: colaborador.id,
        valor_pago: colaborador.valor_a_receber,
        data_pagamento: new Date().toISOString(),
      })
      toast({ title: 'Sucesso', description: 'Pagamento confirmado com sucesso!' })
      handleReset()
    } catch (err) {
      toast({
        title: 'Erro',
        description: 'Não foi possível confirmar o pagamento.',
        variant: 'destructive',
      })
    }
  }

  const handleReset = () => {
    setRegistro('')
    setColaborador(null)
    setFotoDoBanco(null)
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
                    disabled={viewState !== 'EMPTY' && viewState !== 'RECOGNITION_FAILED'}
                  />
                </div>

                {errorMsg && (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={
                    !registro.trim() || viewState === 'SEARCHING' || viewState === 'PROCESSING'
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

                {viewState !== 'EMPTY' && viewState !== 'SEARCHING' && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full mt-2"
                    onClick={handleReset}
                  >
                    Nova Busca
                  </Button>
                )}
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
                  {fotoDoBanco ? (
                    <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-slate-100 dark:border-slate-800 shrink-0">
                      <img
                        src={fotoDoBanco}
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
            {viewState === 'EMPTY' || viewState === 'SEARCHING' ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
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
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />
                <h3 className="text-xl font-semibold mb-2">Processando reconhecimento facial...</h3>
                <p className="text-slate-500">Aguarde enquanto verificamos a identidade.</p>
              </div>
            ) : viewState === 'RECOGNITION_SUCCESS' ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in zoom-in-95 duration-300">
                <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mb-6">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Identidade Verificada</h3>
                <p className="text-slate-500 mb-8">O rosto corresponde ao registro informado.</p>

                <div className="bg-slate-50 dark:bg-slate-900 w-full max-w-sm rounded-xl p-6 mb-8 border border-slate-200 dark:border-slate-800">
                  <p className="text-sm text-slate-500 uppercase tracking-wider font-medium mb-1">
                    Valor a Receber
                  </p>
                  <p className="text-4xl font-bold text-slate-900 dark:text-white">
                    {formatCurrency(colaborador?.valor_a_receber || 0)}
                  </p>
                </div>

                <Button
                  size="lg"
                  className="w-full max-w-sm bg-green-600 hover:bg-green-700 text-white"
                  onClick={handleConfirmPayment}
                >
                  Confirmar Pagamento
                </Button>
              </div>
            ) : viewState === 'RECOGNITION_FAILED' ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in zoom-in-95 duration-300">
                <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mb-6">
                  <AlertCircle className="h-10 w-10" />
                </div>
                <h3 className="text-xl font-bold mb-2">Reconhecimento Falhou</h3>
                <p className="text-slate-500 mb-8 max-w-md">
                  Rosto não corresponde ao registro informado. Tente novamente.
                </p>

                <Button
                  size="lg"
                  variant="outline"
                  className="w-full max-w-sm"
                  onClick={() => setViewState('CAPTURING')}
                >
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Tentar Novamente
                </Button>
              </div>
            ) : viewState === 'CAPTURING' ? (
              <>
                <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden">
                  {!streamActive && (
                    <Loader2 className="absolute h-8 w-8 text-white animate-spin" />
                  )}
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Overlay outline to frame the face */}
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-56 h-56 md:w-72 md:h-72 border-2 border-white/50 rounded-[40px] shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]"></div>
                  </div>
                </div>
                <div className="p-4 bg-slate-900 dark:bg-black border-t border-slate-800 flex justify-center">
                  <Button
                    size="lg"
                    className="rounded-full h-16 w-16 p-0 border-4 border-slate-300 bg-white hover:bg-slate-200"
                    onClick={handleCapture}
                  >
                    <span className="sr-only">Capturar Foto</span>
                  </Button>
                </div>
              </>
            ) : null}
          </Card>
        </div>
      </div>
    </div>
  )
}
