import { useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/hooks/use-auth'
import { Camera, Upload, X } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export function ProfilePhotoModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.size > 5 * 1024 * 1024) {
        toast({
          title: 'Arquivo muito grande',
          description: 'O tamanho máximo permitido é 5MB.',
          variant: 'destructive',
        })
        return
      }
      if (!selectedFile.type.startsWith('image/')) {
        toast({
          title: 'Formato inválido',
          description: 'Por favor, selecione uma imagem.',
          variant: 'destructive',
        })
        return
      }
      setFile(selectedFile)
      const objectUrl = URL.createObjectURL(selectedFile)
      setPreview(objectUrl)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || (!file && preview === null)) return

    setLoading(true)
    try {
      const formData = new FormData()
      if (file) {
        formData.append('avatar', file)
      }

      await pb.collection('users').update(user.id, formData)

      // Re-fetch auth record to update the store and trigger authStore.onChange correctly
      await pb.collection('users').authRefresh()

      toast({
        title: 'Foto atualizada!',
        description: 'Sua foto de perfil foi salva com sucesso.',
      })
      onOpenChange(false)
    } catch (err) {
      toast({
        title: 'Erro ao salvar foto',
        description: 'Não foi possível atualizar a foto de perfil.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setFile(null)
      setPreview(null)
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-forest/10 dark:bg-forest/20 text-forest dark:text-mint-light shrink-0">
              <Camera size={20} />
            </div>
            <div>
              <DialogTitle>Foto de Perfil</DialogTitle>
              <DialogDescription>Adicione ou altere sua foto de perfil.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-4">
          <div className="flex flex-col items-center gap-4">
            <Avatar className="h-24 w-24 border-2 border-slate-200 dark:border-slate-800">
              <AvatarImage src={preview || user?.avatarUrl} className="object-cover" />
              <AvatarFallback className="text-2xl bg-forest/10 text-forest font-semibold">
                {user?.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="flex gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden"
              />
              <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                <Upload size={16} className="mr-2" />
                Selecionar Imagem
              </Button>
              {preview && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                  onClick={() => {
                    setFile(null)
                    setPreview(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                >
                  <X size={16} />
                </Button>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!file || loading}
              className="bg-forest hover:bg-forest/90"
            >
              {loading ? 'Salvando...' : 'Salvar Foto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
