import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'
import { formatBRL } from '@/lib/formatters'
import { Loader2, Search, Link as LinkIcon, FileSearch } from 'lucide-react'

export default function GestaoRegistros() {
  const { toast } = useToast()
  const [pagamentos, setPagamentos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPagamento, setSelectedPagamento] = useState<any | null>(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [colaboradores, setColaboradores] = useState<any[]>([])
  const [searching, setSearching] = useState(false)

  const loadOrphanPagamentos = async () => {
    setLoading(true)
    try {
      const records = await pb.collection('pagamentos').getFullList({
        filter: 'colaborador_id = ""',
        sort: '-created',
      })
      setPagamentos(records)
    } catch (e: any) {
      toast({ title: 'Erro ao carregar pagamentos órfãos', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrphanPagamentos()
  }, [])

  const handleSearchColaboradores = async () => {
    if (!searchTerm) return
    setSearching(true)
    try {
      const records = await pb.collection('colaboradores').getList(1, 10, {
        filter: `nome ~ "${searchTerm}" || registro ~ "${searchTerm}"`,
      })
      setColaboradores(records.items)
    } catch (e) {
      toast({ title: 'Erro na busca', variant: 'destructive' })
    } finally {
      setSearching(false)
    }
  }

  const handleLink = async (colaboradorId: string) => {
    if (!selectedPagamento) return
    try {
      await pb.collection('pagamentos').update(selectedPagamento.id, {
        colaborador_id: colaboradorId,
      })
      toast({ title: 'Pagamento vinculado com sucesso!' })
      setSelectedPagamento(null)
      loadOrphanPagamentos()
    } catch (e) {
      toast({ title: 'Erro ao vincular', variant: 'destructive' })
    }
  }

  return (
    <div className="container mx-auto py-8 px-4 space-y-6 animate-fade-in-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Gestão de Registros (Pagamentos Órfãos)
        </h1>
        <p className="text-muted-foreground mt-1">
          Identifique e associe pagamentos não vinculados aos colaboradores corretos.
        </p>
      </div>

      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                <TableRow>
                  <TableHead>Data Original</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Nome Registrado</TableHead>
                  <TableHead>Registro Informado</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12">
                      <Loader2 className="animate-spin mx-auto h-8 w-8 text-blue-500 mb-2" />
                      <span className="text-muted-foreground">Buscando pagamentos...</span>
                    </TableCell>
                  </TableRow>
                ) : pagamentos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                      <FileSearch className="mx-auto h-12 w-12 opacity-30 mb-3" />
                      Nenhum pagamento órfão encontrado no sistema.
                    </TableCell>
                  </TableRow>
                ) : (
                  pagamentos.map((p) => (
                    <TableRow
                      key={p.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
                    >
                      <TableCell>
                        {p.data_pagamento ? p.data_pagamento.split(' ')[0] : '-'}
                      </TableCell>
                      <TableCell className="font-medium text-emerald-600">
                        {formatBRL(p.valor_pago || p.valor || 0)}
                      </TableCell>
                      <TableCell>{p.nome || 'N/A'}</TableCell>
                      <TableCell>{p.registro || 'N/A'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm" onClick={() => setSelectedPagamento(p)}>
                          <LinkIcon className="h-4 w-4 mr-2 text-blue-500" /> Vincular
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={!!selectedPagamento}
        onOpenChange={(open) => !open && setSelectedPagamento(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Vincular a Colaborador</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-md text-sm border space-y-1">
              <p>
                <span className="font-medium text-muted-foreground">Valor:</span>{' '}
                {formatBRL(selectedPagamento?.valor_pago || selectedPagamento?.valor || 0)}
              </p>
              <p>
                <span className="font-medium text-muted-foreground">Nome Órfão:</span>{' '}
                {selectedPagamento?.nome || 'N/A'}
              </p>
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="Buscar por nome ou registro..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearchColaboradores()}
              />
              <Button onClick={handleSearchColaboradores} disabled={searching}>
                {searching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {colaboradores.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-3 border rounded-md hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-colors"
                >
                  <div>
                    <p className="font-medium text-sm text-slate-900 dark:text-slate-100">
                      {c.nome}
                    </p>
                    <p className="text-xs text-muted-foreground">Reg: {c.registro}</p>
                  </div>
                  <Button size="sm" onClick={() => handleLink(c.id)}>
                    Selecionar
                  </Button>
                </div>
              ))}
              {colaboradores.length === 0 && !searching && searchTerm && (
                <p className="text-center text-sm text-muted-foreground py-6">
                  Nenhum colaborador encontrado.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelectedPagamento(null)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
