import { useState, useRef, useCallback, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import {
  Camera,
  UploadCloud,
  Loader2,
  CameraIcon,
  RefreshCcw,
  Save,
  HelpCircle,
} from 'lucide-react'
import { PhotoPreviewModal } from '@/components/PhotoPreviewModal'

export default function DPFotos() {
  const [registro, setRegistro] = useState('')
  const [nome, setNome] = useState('')
  const [isLoadingNome, setIsLoadingNome] = useState(false)
  const [nomeError, setNomeError] = useState('')
  const [hasExistingPhoto, setHasExistingPhoto] = useState(false)
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null)
  const [lastSearchedRegistro, setLastSearchedRegistro] = useState('')

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  const [previewModalOpen, setPreviewModalOpen] = useState(false)

  const [activeTab, setActiveTab] = useState('camera')
  const [isCapturing, setIsCapturing] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const fetchNome = async () => {
    const currentRegistro = registro.trim()
    if (!currentRegistro) {
      setNome('')
      setNomeError('')
      setHasExistingPhoto(false)
      setExistingPhotoUrl(null)
      setLastSearchedRegistro('')
      return
    }

    if (currentRegistro === lastSearchedRegistro) {
      return
    }

    setIsLoadingNome(true)
    setNomeError('')
    setNome('')
    setHasExistingPhoto(false)
    setExistingPhotoUrl(null)

    try {
      const res = await pb.send(
        `/backend/v1/get-colaborador-by-registro?registro=${encodeURIComponent(currentRegistro)}`,
        { method: 'GET' },
      )
      setNome(res.nome)

      try {
        const photoRecord = await pb
          .collection('fotos_colaboradores')
          .getFirstListItem(`registro="${currentRegistro}"`)
        setHasExistingPhoto(true)
        if (photoRecord.foto) {
          setExistingPhotoUrl(pb.files.getUrl(photoRecord, photoRecord.foto))
        } else if (photoRecord.foto_url) {
          setExistingPhotoUrl(photoRecord.foto_url)
        }
      } catch (err) {
        setHasExistingPhoto(false)
        setExistingPhotoUrl(null)
      }
    } catch (err: any) {
      if (err.status === 404) {
        setNomeError('Registro não encontrado')
      } else {
        setNomeError('Serviço temporariamente indisponível')
        console.error(err)
      }
    } finally {
      setIsLoadingNome(false)
      setLastSearchedRegistro(currentRegistro)
    }
  }

  const handleBlur = () => {
    fetchNome()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      fetchNome()
    }
  }

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [])

  const startCamera = useCallback(async () => {
    stopCamera()
    setPreview(null)
    setFile(null)
    setIsCapturing(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
    } catch (err) {
      console.error(err)
      toast.error('Câmera não detectada ou permissão negada.')
      setIsCapturing(false)
    }
  }, [stopCamera])

  useEffect(() => {
    if (activeTab === 'camera') {
      startCamera()
    } else {
      stopCamera()
      setIsCapturing(false)
    }
    return () => stopCamera()
  }, [activeTab, startCamera, stopCamera])

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')

    if (context) {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      context.drawImage(video, 0, 0, canvas.width, canvas.height)

      const dataUrl = canvas.toDataURL('image/jpeg')
      setPreview(dataUrl)

      canvas.toBlob((blob) => {
        if (blob) {
          const capturedFile = new File([blob], `foto_${Date.now()}.jpg`, { type: 'image/jpeg' })
          setFile(capturedFile)
        }
      }, 'image/jpeg')

      stopCamera()
      setIsCapturing(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = e.target.files[0]
      setFile(selected)
      setPreview(URL.createObjectURL(selected))
    }
  }

  const retakePhoto = () => {
    startCamera()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!registro.trim()) {
      toast.error('Informe o Registro do Colaborador.')
      return
    }

    if (!file) {
      toast.error('Capture ou envie uma foto primeiro.')
      return
    }

    setSubmitting(true)

    try {
      const formData = new FormData()
      formData.append('registro', registro.trim())
      formData.append('foto', file)
      formData.append('origem', 'captura')
      formData.append('data_upload', new Date().toISOString())

      try {
        const existing = await pb
          .collection('fotos_colaboradores')
          .getFirstListItem(`registro="${registro.trim()}"`)
        await pb.collection('fotos_colaboradores').update(existing.id, formData)
        toast.success('Registro atualizado com sucesso!')
      } catch (err: any) {
        if (err.status === 404) {
          await pb.collection('fotos_colaboradores').create(formData)
          toast.success('Registro salvo com sucesso!')
        } else {
          throw err
        }
      }

      setRegistro('')
      setNome('')
      setHasExistingPhoto(false)
      setExistingPhotoUrl(null)
      setFile(null)
      setPreview(null)
      setLastSearchedRegistro('')
      if (activeTab === 'camera') startCamera()
    } catch (err) {
      console.error(err)
      toast.error('Erro ao salvar o registro. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="container max-w-3xl mx-auto py-8 px-4 animate-in fade-in duration-500">
      <Card className="shadow-lg border-slate-200 dark:border-slate-800">
        <CardHeader className="text-center pb-6">
          <div className="mx-auto bg-mint/10 dark:bg-mint/20 p-3 rounded-full w-16 h-16 flex items-center justify-center mb-2">
            <CameraIcon className="w-8 h-8 text-forest dark:text-mint" />
          </div>
          <CardTitle className="text-2xl font-bold">Captura de Foto</CardTitle>
          <CardDescription>
            Tire ou envie a foto do colaborador para o banco de dados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form id="foto-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="registro" className="text-base font-semibold">
                Registro do Colaborador
              </Label>
              <div className="relative">
                <Input
                  id="registro"
                  value={registro}
                  onChange={(e) => setRegistro(e.target.value)}
                  onBlur={handleBlur}
                  onKeyDown={handleKeyDown}
                  placeholder="Ex: 123456"
                  className="h-12 text-lg text-center font-mono tracking-widest bg-slate-50 dark:bg-slate-900"
                  required
                />
                {isLoadingNome && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                  </div>
                )}
              </div>
              {nomeError && <p className="text-sm text-red-500 font-medium">{nomeError}</p>}
              {!nomeError && !isLoadingNome && nome && (
                <p className="text-sm text-green-600 dark:text-green-500 font-medium animate-in fade-in">
                  ✓ Colaborador: {nome}
                </p>
              )}
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="camera" className="flex items-center gap-2">
                  <Camera size={16} /> Câmera
                </TabsTrigger>
                <TabsTrigger value="upload" className="flex items-center gap-2">
                  <UploadCloud size={16} /> Arquivo
                </TabsTrigger>
              </TabsList>

              <TabsContent value="camera" className="space-y-4">
                <div className="relative rounded-xl overflow-hidden bg-slate-950 aspect-video md:aspect-[4/3] flex items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800">
                  {preview ? (
                    <img src={preview} alt="Preview" className="w-full h-full object-contain" />
                  ) : isCapturing ? (
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-slate-500 flex flex-col items-center">
                      <Camera size={48} className="mb-2 opacity-50" />
                      <span>Câmera desligada</span>
                    </div>
                  )}
                  <canvas ref={canvasRef} className="hidden" />
                </div>

                <div className="flex justify-center">
                  {preview ? (
                    <Button type="button" variant="outline" onClick={retakePhoto} className="gap-2">
                      <RefreshCcw size={16} /> Tirar outra foto
                    </Button>
                  ) : isCapturing ? (
                    <Button
                      type="button"
                      onClick={capturePhoto}
                      className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Camera size={16} /> Capturar
                    </Button>
                  ) : (
                    <Button type="button" onClick={startCamera} className="gap-2">
                      <Camera size={16} /> Ligar Câmera
                    </Button>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="upload" className="space-y-4">
                <div className="relative rounded-xl overflow-hidden bg-slate-50 dark:bg-slate-900 aspect-video md:aspect-[4/3] flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 p-4">
                  {preview ? (
                    <img
                      src={preview}
                      alt="Preview"
                      className="max-w-full max-h-full object-contain rounded-md"
                    />
                  ) : (
                    <div className="text-center">
                      <UploadCloud size={48} className="mx-auto mb-4 text-slate-400" />
                      <p className="text-sm text-slate-500 mb-2">
                        Clique ou arraste uma imagem aqui
                      </p>
                    </div>
                  )}
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
              </TabsContent>
            </Tabs>

            {hasExistingPhoto && (
              <div className="flex items-center gap-3 text-red-500 bg-red-50 dark:bg-red-500/10 p-3 rounded-md animate-in fade-in slide-in-from-top-2">
                <HelpCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium flex-1">
                  O colaborador já possui uma foto cadastrada no sistema.
                </span>
                {existingPhotoUrl && (
                  <img
                    src={existingPhotoUrl}
                    alt="Foto existente"
                    className="w-12 h-12 rounded-md object-cover border border-red-200 dark:border-red-500/30 flex-shrink-0 cursor-pointer hover:scale-105 hover:opacity-90 transition-all duration-200 shadow-sm"
                    onClick={() => setPreviewModalOpen(true)}
                  />
                )}
              </div>
            )}
          </form>
        </CardContent>
        <CardFooter className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-b-xl border-t border-slate-200 dark:border-slate-800">
          <Button
            type="submit"
            form="foto-form"
            className="w-full h-12 text-lg bg-forest hover:bg-forest/90 text-white gap-2 shadow-md"
            disabled={submitting || !file || !registro || isLoadingNome || !!nomeError}
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            {submitting ? 'Salvando...' : 'Salvar Registro'}
          </Button>
        </CardFooter>
      </Card>

      <PhotoPreviewModal
        open={previewModalOpen}
        onOpenChange={setPreviewModalOpen}
        fotoUrl={existingPhotoUrl}
        registro={registro}
        nome={nome}
      />
    </div>
  )
}
