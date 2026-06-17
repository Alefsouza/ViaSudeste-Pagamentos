import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Search, CheckCircle } from 'lucide-react'
import { formatBRL, checkIsLocked } from '@/lib/formatters'
import { format } from 'date-fns'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { extractFieldErrors } from '@/lib/pocketbase/errors'

export function DashboardPaymentModal({
  maxRef,
  onRefresh,
}: {
  maxRef: number
  onRefresh: () => void
}) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [records, setRecords] = useState<any[]>([])

  const [photos, setPhotos] = useState<Record<string, File | null>>({})
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({})

  const handleSearch = async () => {
    if (!search.trim()) return
    setLoading(true)
    try {
      const res = await pb.collection('colaboradores').getList(1, 50, {
        filter: `(nome ~ "${search}" || registro = "${search}") && foto_confirmacao_url = ""`,
        sort: '-created',
      })

      const filtered = res.items.filter((r) => {
        if (r.foto_confirmacao_url) return false
        if (r.liberado_pagamento === true) return true
        const ref = r.referencia || 0
        if (ref >= maxRef - 3) {
          return !checkIsLocked(r)
        }
        return false
      })

      setRecords(filtered)
    } catch (e) {
      toast({ title: 'Erro na busca', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async (record: any) => {
    const confirmPhoto = photos[record.id]

    if (!confirmPhoto) {
      toast({
        title: 'É necessário anexar um comprovante para confirmar o pagamento.',
        variant: 'destructive',
      })
      return
    }

    setSubmitting((prev) => ({ ...prev, [record.id]: true }))
    try {
      const formData = new FormData()
      formData.append('colaborador_id', record.id)
      formData.append('registro', record.registro || '')
      formData.append('nome', record.nome || '')
      formData.append('valor_pago', String(record.valor_a_receber || record.valor || 0))
      formData.append('data_pagamento', format(new Date(), 'yyyy-MM-dd HH:mm:ss'))
      formData.append('status', 'Confirmado')
      formData.append('foto_confirmacao', confirmPhoto)

      if (user?.id) {
        formData.append('user_id', user.id)
      }

      if (record.idtipopgto != null) {
        formData.append('idtipopgto', String(record.idtipopgto))
      }

      const filialNumber =
        record.filial_id ||
        (record.filial === 'Cursino' ? 1 : record.filial === 'Sapopemba' ? 2 : '')
      if (filialNumber) {
        formData.append('filial', String(filialNumber))
      }

      await pb.collection('pagamentos').create(formData)

      toast({ title: 'Pagamento aprovado com sucesso!' })
      setOpen(false)
      setRecords([])
      onRefresh()
    } catch (err: any) {
      const errors = extractFieldErrors(err)
      const msgs = Object.entries(errors).map(([field, msg]) => `Campo '${field}': ${msg}`)
      const msg = msgs.length > 0 ? msgs.join(', ') : err.message || 'Erro ao confirmar pagamento'
      toast({ title: 'Erro ao confirmar', description: msg, variant: 'destructive' })
    } finally {
      setSubmitting((prev) => ({ ...prev, [record.id]: false }))
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
          <CheckCircle className="w-4 h-4 mr-2" />
          Realizar Pagamento
        </Button>
      </DialogTrigger>
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
          />
          <Button onClick={handleSearch} disabled={loading}>
            <Search className="w-4 h-4 mr-2" />
            Buscar
          </Button>
        </div>

        {records.length > 0 ? (
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Referência</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Comprovante</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((r) => (
                  <TableRow key={r.id}>
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
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => handleConfirm(r)}
                        disabled={submitting[r.id]}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        Confirmar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
