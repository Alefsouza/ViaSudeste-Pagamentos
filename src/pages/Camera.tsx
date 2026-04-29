import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Search, Camera as CameraIcon, User, Building, DollarSign } from 'lucide-react'
import { getColaboradorByRegistro } from '@/services/colaboradores'
import { createPagamento } from '@/services/pagamentos'
import pb from '@/lib/pocketbase/client'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'

export default function Camera() {
  const [registro, setRegistro] = useState('')
  const [colaborador, setColaborador] = useState<any>(null)
  const [loadingSearch, setLoadingSearch] = useState(false)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loadingPagamento, setLoadingPagamento] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const { toast } = useToast()

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    setCameraActive(false)
  }

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = mediaStream
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
      setCameraActive(true)
    } catch (err) {
      toast({
        title: 'Erro ao acessar a câmera',
        description: 'Por favor, permita o acesso à câmera do seu dispositivo para continuar.',
        variant: 'destructive',
      })
      setCameraActive(false)
    }
  }

  useEffect(() => {
    if (colaborador) {
      startCamera()
    } else {
      stopCamera()
    }
    return () => {
      stopCamera()
    }
  }, [colaborador])

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!registro.trim()) return

    setLoadingSearch(true)
    setColaborador(null)
    try {
      const colab = await getColaboradorByRegistro(registro.trim())
      setColaborador(colab)
    } catch (err: any) {
      toast({
        title: 'Colaborador não encontrado',
        description: 'Verifique o número de registro e tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setLoadingSearch(false)
    }
  }

  const capturePhoto = (): Promise<File> => {
    return new Promise((resolve, reject) => {
      if (!videoRef.current) return reject(new Error('Câmera indisponível'))
      const video = videoRef.current
      const canvas = document.createElement('canvas')

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Falha ao processar imagem'))

      // Flips the context horizontally to match the mirrored video preview
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Falha ao gerar arquivo de imagem'))
          const file = new File([blob], 'captura.jpg', { type: 'image/jpeg' })
          resolve(file)
        },
        'image/jpeg',
        0.8,
      )
    })
  }

  const handleConfirm = async () => {
    if (!colaborador || !cameraActive) return

    setLoadingPagamento(true)
    try {
      const photoFile = await capturePhoto()

      await createPagamento({
        colaborador_id: colaborador.id,
        valor_pago: colaborador.valor_a_receber,
        data_pagamento: new Date().toISOString(),
        foto_confirmacao: photoFile,
      })

      toast({
        title: 'Pagamento confirmado com sucesso',
        description: 'A foto e o registro foram salvos no sistema.',
      })

      setRegistro('')
      setColaborador(null)
      setConfirmOpen(false)
    } catch (err: any) {
      toast({
        title: 'Erro ao confirmar pagamento',
        description:
          err.message ||
          err.response?.message ||
          'Ocorreu um erro inesperado. Verifique sua conexão.',
        variant: 'destructive',
      })
    } finally {
      setLoadingPagamento(false)
    }
  }

  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  const getFotoUrl = (colab: any) => {
    if (!colab || !colab.foto) return null
    return pb.files.getURL(colab, colab.foto)
  }

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4 animate-fade-in">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-6">
        Registro de Pagamento
      </h1>

      <Card className="mb-6 shadow-sm border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle>Buscar Colaborador</CardTitle>
          <CardDescription>
            Digite o registro para localizar o colaborador e iniciar o processo de captura.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Ex: 0006962"
                className="pl-9"
                value={registro}
                onChange={(e) => setRegistro(e.target.value)}
                disabled={loadingSearch || loadingPagamento}
              />
            </div>
            <Button type="submit" disabled={loadingSearch || loadingPagamento || !registro.trim()}>
              {loadingSearch ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Buscar'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {loadingSearch && (
        <Card className="shadow-sm">
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-[400px] w-full mt-4 rounded-xl" />
          </CardContent>
        </Card>
      )}

      {colaborador && !loadingSearch && (
        <Card className="shadow-sm border-blue-100 dark:border-blue-900 animate-slide-up overflow-hidden">
          <div className="bg-blue-50 dark:bg-blue-950/30 p-6 border-b border-blue-100 dark:border-blue-900">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-600" />
                  {colaborador.nome}
                </h2>
                <div className="flex items-center gap-4 mt-2 text-sm text-slate-600 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <span className="font-medium text-slate-500">Reg:</span> {colaborador.registro}
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
                <div className="text-2xl font-bold text-emerald-600">
                  {formatBRL(colaborador.valor_a_receber)}
                </div>
              </div>
            </div>
          </div>

          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label className="text-base font-semibold block text-center md:text-left text-slate-700 dark:text-slate-300">
                  Foto do Sistema
                </Label>
                <div className="relative rounded-xl overflow-hidden border-2 border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 aspect-[3/4] flex flex-col items-center justify-center">
                  {colaborador.foto ? (
                    <img
                      src={getFotoUrl(colaborador) || ''}
                      alt="Foto do Colaborador"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-slate-500 flex flex-col items-center p-6 text-center">
                      <User className="h-12 w-12 mb-3 opacity-20" />
                      <p className="text-sm font-medium">Nenhuma foto registrada no perfil</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-base font-semibold block text-center md:text-left text-slate-700 dark:text-slate-300">
                  Câmera ao Vivo
                </Label>
                <div className="relative rounded-xl overflow-hidden border-2 border-slate-200 dark:border-slate-800 bg-black aspect-[3/4]">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform -scale-x-100"
                  />
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div className="w-[65%] h-[55%] border-4 border-dashed border-white/40 rounded-[100%] shadow-[0_0_0_9999px_rgba(0,0,0,0.3)] transition-all duration-1000" />
                  </div>
                  {!cameraActive && (
                    <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center text-slate-400 gap-3 z-10">
                      <Loader2 className="h-8 w-8 animate-spin" />
                      <span className="text-sm font-medium">Iniciando câmera...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <Button
              className="w-full h-14 text-lg font-medium shadow-md hover:shadow-lg transition-all mt-4"
              size="lg"
              disabled={!cameraActive || loadingPagamento}
              onClick={() => setConfirmOpen(true)}
            >
              <CameraIcon className="h-6 w-6 mr-2" />
              Capturar e Confirmar Pagamento
            </Button>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Pagamento?</AlertDialogTitle>
            <AlertDialogDescription className="text-base text-slate-600 dark:text-slate-400">
              Tem certeza que deseja confirmar o pagamento e capturar a foto de{' '}
              <strong className="text-slate-900 dark:text-slate-100 font-bold">
                {colaborador?.nome}
              </strong>
              ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loadingPagamento}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirm()
              }}
              disabled={loadingPagamento}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {loadingPagamento ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CameraIcon className="h-4 w-4 mr-2" />
              )}
              Sim, Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
