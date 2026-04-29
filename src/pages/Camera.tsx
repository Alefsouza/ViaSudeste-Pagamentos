import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import {
  Loader2,
  Search,
  Camera as CameraIcon,
  Upload,
  CheckCircle2,
  User,
  Building,
  DollarSign,
} from 'lucide-react'
import { getColaboradorByRegistro } from '@/services/colaboradores'
import { createPagamento } from '@/services/pagamentos'
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
  const [foto, setFoto] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loadingPagamento, setLoadingPagamento] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!registro.trim()) return

    setLoadingSearch(true)
    setColaborador(null)
    setFoto(null)
    setFotoPreview(null)
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0]
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Arquivo inválido',
          description: 'Por favor, selecione uma imagem.',
          variant: 'destructive',
        })
        return
      }
      setFoto(file)
      setFotoPreview(URL.createObjectURL(file))
    }
  }

  const handleConfirm = async () => {
    if (!colaborador || !foto) return

    setLoadingPagamento(true)
    try {
      await createPagamento({
        colaborador_id: colaborador.id,
        valor_pago: colaborador.valor_a_receber,
        data_pagamento: new Date().toISOString(),
        foto_confirmacao: foto,
      })

      toast({
        title: 'Pagamento confirmado',
        description: 'O pagamento foi registrado com sucesso.',
      })

      // Reset form
      setRegistro('')
      setColaborador(null)
      setFoto(null)
      setFotoPreview(null)
      setConfirmOpen(false)
    } catch (err: any) {
      toast({
        title: 'Erro ao confirmar pagamento',
        description: err.response?.message || 'Ocorreu um erro inesperado. Verifique sua conexão.',
        variant: 'destructive',
      })
    } finally {
      setLoadingPagamento(false)
    }
  }

  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4 animate-fade-in">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-6">
        Registro de Pagamento
      </h1>

      <Card className="mb-6 shadow-sm border-slate-200 dark:border-slate-800">
        <CardHeader>
          <CardTitle>Buscar Colaborador</CardTitle>
          <CardDescription>Digite o registro para localizar o colaborador</CardDescription>
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
            <Skeleton className="h-8 w-1/4" />
          </CardContent>
        </Card>
      )}

      {colaborador && !loadingSearch && (
        <Card className="shadow-sm border-blue-100 dark:border-blue-900 animate-slide-up overflow-hidden">
          <div className="bg-blue-50 dark:bg-blue-950/30 p-6 border-b border-blue-100 dark:border-blue-900">
            <div className="flex justify-between items-start">
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
              <div className="text-right bg-white dark:bg-slate-900 p-3 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800">
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
            <div className="space-y-3">
              <Label className="text-base">Foto de Confirmação</Label>

              {!fotoPreview ? (
                <div
                  className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="bg-blue-100 dark:bg-blue-900/50 p-4 rounded-full">
                    <CameraIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      Toque para abrir a câmera
                    </p>
                    <p className="text-sm text-slate-500">ou selecione uma foto da galeria</p>
                  </div>
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-black/5">
                  <img
                    src={fotoPreview}
                    alt="Preview"
                    className="w-full h-[300px] object-contain"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    className="absolute bottom-4 right-4 shadow-md"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" /> Trocar foto
                  </Button>
                </div>
              )}

              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
            </div>

            <Button
              className="w-full h-12 text-base"
              size="lg"
              disabled={!foto || loadingPagamento}
              onClick={() => setConfirmOpen(true)}
            >
              <CheckCircle2 className="h-5 w-5 mr-2" />
              Confirmar Pagamento
            </Button>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Pagamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja confirmar o pagamento de{' '}
              <strong className="text-slate-900 dark:text-slate-100">
                {colaborador && formatBRL(colaborador.valor_a_receber)}
              </strong>{' '}
              para{' '}
              <strong className="text-slate-900 dark:text-slate-100">{colaborador?.nome}</strong>?
              Esta ação não pode ser desfeita.
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
              {loadingPagamento ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Sim, Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
