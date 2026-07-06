import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Search, CheckCircle, Loader2 } from 'lucide-react'
import { formatBRL, checkIsLocked } from '@/lib/formatters'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { batchConfirmPagamentos } from '@/services/pagamentos'
import { cn } from '@/lib/utils'

export function DashboardPaymentModal({
  maxRef,
  onPaymentConfirmed,
}: {
  maxRef: number
  onPaymentConfirmed: (colaboradorIds: string[]) => void
}) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const canConfirm = user?.role === 'Administrador' || user?.role === 'recebedoria'
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [records, setRecords] = useState<any[]>([])
  const [photos, setPhotos] = useState<Record<string, File | null>>({})
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [batchLoading, setBatchLoading] = useState(false)

  const handleSearch = async () => {
    if (!search.trim()) return
    setLoading(true)
    try {
      const res = await pb.collection('colaboradores').getList(1, 50, {
        filter: `(nome ~ "${search}" || registro = "${search}") && foto_confirmacao_url = ""`,
        sort: '-created',
        fields:
          'id,registro,nome,valor_a_receber,valor,referencia,liberado_pagamento,data_liberacao,idtipopgto,tipo_pagamento,inicio,termino,horas,filial,filial_id',
      })

      const filtered = res.items.filter((r: any) => {
        if (r.foto_confirmacao_url) return false
        if (checkIsLocked(r.data_liberacao)) return false
        const ref = r.referencia || 0
        if (ref > 0 && maxRef > 0 && ref < maxRef - 3) {
          return r.liberado_pagamento === true
        }
        return true
      })

      setRecords(filtered)
      setSelected(new Set(filtered.map((r: any) => r.id)))
      setPhotos({})
    } catch {
      toast({ title: 'Erro na busca', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const toggleSelection = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleBatchConfirm = async () => {
    const selectedRecords = records.filter((r) => selected.has(r.id))
    if (selectedRecords.length === 0) {
      toast({ title: 'Selecione ao menos um pagamento.', variant: 'destructive' })
      return
    }

    const missingPhotos = selectedRecords.filter((r) => !photos[r.id])
    if (missingPhotos.length > 0) {
      toast({
        title: 'Fotos obrigatórias',
        description: `${missingPhotos.length} pagamento(s) sem comprovante anexado.`,
        variant: 'destructive',
      })
      return
    }

    setBatchLoading(true)
    try {
      const now = new Date()
      const utcMinus3 = new Date(now.getTime() - 3 * 3600000)
      const pad = (n: number) => n.toString().padStart(2, '0')

      const payments = selectedRecords.map((r) => ({
        colaborador_id: r.id,
        registro: r.registro || '',
        nome: r.nome || '',
        valor_pago: String(r.valor_a_receber || r.valor || 0),
        data_pagamento: now.toISOString(),
        hora_pagamento: `${pad(utcMinus3.getUTCHours())}:${pad(utcMinus3.getUTCMinutes())}`,
        idtipopgto: r.idtipopgto ?? null,
        tipo_pagamento: r.tipo_pagamento || '',
        inicio: r.inicio || '',
        termino: r.termino || '',
        horas: r.horas || '',
        filial: r.filial_id || (r.filial === 'Cursino' ? 1 : r.filial === 'Sapopemba' ? 2 : ''),
      }))

      const photoMap: Record<number, File> = {}
      selectedRecords.forEach((r, i) => {
        if (photos[r.id]) photoMap[i] = photos[r.id]!
      })

      const result = await batchConfirmPagamentos(payments, photoMap)

      const successes = result.results?.filter((r: any) => r.success) || []
      const failures = result.results?.filter((r: any) => !r.success) || []

      if (successes.length > 0) {
        const confirmedIds = successes.map((s: any) => s.colaborador_id).filter(Boolean)
        onPaymentConfirmed(confirmedIds)
      }

      if (failures.length > 0) {
        toast({
          title: `${failures.length} pagamento(s) falhou(ram)`,
          description: failures.map((f: any) => f.error).join('; '),
          variant: 'destructive',
        })
        const failedIds = new Set(failures.map((f: any) => f.colaborador_id).filter(Boolean))
        setRecords((prev) => prev.filter((r) => failedIds.has(r.id)))
        setSelected(new Set(failedIds))
      } else {
        toast({ title: `${successes.length} pagamento(s) confirmado(s) com sucesso!` })
        setRecords([])
        setPhotos({})
        setSelected(new Set())
        setOpen(false)
      }
    } catch (err: any) {
      toast({
        title: 'Erro ao confirmar pagamentos',
        description: err.message || 'Erro inesperado',
        variant: 'destructive',
      })
    } finally {
      setBatchLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild></DialogTrigger>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confirmar Pagamentos</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 my-4">
          <Input
            placeholder="Buscar por nome ou registro..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            disabled={batchLoading}
          />
          <Button onClick={handleSearch} disabled={loading || batchLoading}>
            {loading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Search className="w-4 h-4 mr-2" />
            )}
            Buscar
          </Button>
        </div>

        {records.length > 0 ? (
          <>
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selected.size === records.length && records.length > 0}
                        onCheckedChange={(checked) => {
                          if (checked) setSelected(new Set(records.map((r) => r.id)))
                          else setSelected(new Set())
                        }}
                        disabled={batchLoading}
                      />
                    </TableHead>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Referência</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Comprovante</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((r) => (
                    <TableRow
                      key={r.id}
                      className={cn(
                        batchLoading && 'opacity-50',
                        !selected.has(r.id) && 'opacity-60',
                      )}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selected.has(r.id)}
                          onCheckedChange={() => toggleSelection(r.id)}
                          disabled={batchLoading}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{r.nome || 'Desconhecido'}</div>
                        <div className="text-xs text-muted-foreground">{r.registro}</div>
                      </TableCell>
                      <TableCell>
                        {r.referencia || '-'}
                        {r.liberado_pagamento && (
                          <span className="ml-2 text-xs text-emerald-600">(Liberado)</span>
                        )}
                      </TableCell>
                      <TableCell className="font-bold text-emerald-600">
                        {formatBRL(r.valor_a_receber || r.valor)}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null
                            setPhotos((prev) => ({ ...prev, [r.id]: file }))
                          }}
                          className="w-56"
                          disabled={batchLoading}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end mt-4">
              {canConfirm ? (
                <Button
                  onClick={handleBatchConfirm}
                  disabled={batchLoading || selected.size === 0}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {batchLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Confirmando {selected.size} pagamento(s)...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Confirmar Selecionados ({selected.size})
                    </>
                  )}
                </Button>
              ) : (
                <span className="text-sm text-muted-foreground py-2">Sem permissão</span>
              )}
            </div>
          </>
        ) : (
          search &&
          !loading && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum pagamento pendente válido encontrado para esta busca.
            </div>
          )
        )}
      </DialogContent>
    </Dialog>
  )
}
