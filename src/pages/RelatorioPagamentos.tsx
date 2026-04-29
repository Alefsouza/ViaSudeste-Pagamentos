import { useState, useEffect } from 'react'
import { getPagamentosPaginated, getPagamentosStats } from '@/services/pagamentos'
import pb from '@/lib/pocketbase/client'
import { useRealtime } from '@/hooks/use-realtime'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Search,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  FileSearch,
  Building,
  FileDigit,
  Calendar as CalendarIcon,
  Clock,
} from 'lucide-react'

export default function RelatorioPagamentos() {
  const [data, setData] = useState<any[]>([])
  const [stats, setStats] = useState({ count: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filial, setFilial] = useState('Todas')

  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500)
    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, startDate, endDate, filial])

  const loadData = async () => {
    setLoading(true)
    setError(false)
    try {
      const filters = { search: debouncedSearch, startDate, endDate, filial }
      const [newStats, paginated] = await Promise.all([
        getPagamentosStats(filters),
        getPagamentosPaginated(page, 20, filters),
      ])
      setStats(newStats)
      setData(paginated.items)
      setTotalPages(paginated.totalPages || 1)
    } catch (err) {
      console.error(err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [page, debouncedSearch, startDate, endDate, filial])
  useRealtime('pagamentos', loadData)

  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  const formatDateTime = (isoString: string) => {
    const d = new Date(isoString)
    return {
      date: d.toLocaleDateString('pt-BR'),
      time: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    }
  }

  const renderSkeletons = () =>
    [...Array(5)].map((_, i) => (
      <TableRow key={i}>
        <TableCell>
          <Skeleton className="h-4 w-32" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-20" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-24" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-24" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-16" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-4 w-20" />
        </TableCell>
        <TableCell>
          <Skeleton className="h-8 w-24" />
        </TableCell>
      </TableRow>
    ))

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Relatório de Pagamentos
        </h1>
        <p className="text-muted-foreground mt-1">
          Auditoria e histórico detalhado de pagamentos realizados.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl border shadow-sm">
        <div className="space-y-2">
          <Label>Buscar Colaborador</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Nome ou Registro..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Filial</Label>
          <Select value={filial} onValueChange={setFilial}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Todas">Todas as Filiais</SelectItem>
              <SelectItem value="Cursino">Cursino</SelectItem>
              <SelectItem value="Sapopemba">Sapopemba</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Data Inicial</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Data Final</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-blue-50 dark:bg-blue-950/30 p-4 rounded-xl border border-blue-100 dark:border-blue-900/50">
        <div>
          <h2 className="text-sm font-semibold text-blue-900 dark:text-blue-100 uppercase tracking-wider">
            Resumo do Período
          </h2>
          <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
            Total de pagamentos: <span className="font-bold">{stats.count}</span>
          </p>
        </div>
        <div className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-2 sm:mt-0">
          Total pago: {formatBRL(stats.total)}
        </div>
      </div>

      {error ? (
        <div className="text-center py-12 text-rose-500 bg-rose-50 dark:bg-rose-950/20 rounded-xl border border-rose-100 dark:border-rose-900/50">
          <AlertCircle className="mx-auto h-12 w-12 mb-4 opacity-50" />
          <h3 className="text-lg font-semibold">Erro ao carregar pagamentos</h3>
          <Button
            variant="outline"
            className="mt-4 border-rose-200 text-rose-600 hover:bg-rose-100"
            onClick={loadData}
          >
            Tentar novamente
          </Button>
        </div>
      ) : (
        <>
          <div className="hidden md:block rounded-xl border bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-800/50">
                <TableRow>
                  <TableHead>Nome do Colaborador</TableHead>
                  <TableHead>Registro</TableHead>
                  <TableHead>Filial</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Hora</TableHead>
                  <TableHead className="text-right">Valor Pago</TableHead>
                  <TableHead className="text-center">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  renderSkeletons()
                ) : data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                      Nenhum pagamento encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((item) => {
                    const { date, time } = formatDateTime(item.data_pagamento)
                    const colab = item.expand?.colaborador_id
                    return (
                      <TableRow
                        key={item.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
                      >
                        <TableCell className="font-medium">{colab?.nome}</TableCell>
                        <TableCell>{colab?.registro}</TableCell>
                        <TableCell>{colab?.filial}</TableCell>
                        <TableCell>{date}</TableCell>
                        <TableCell>{time}</TableCell>
                        <TableCell className="text-right font-medium text-emerald-600">
                          {formatBRL(item.valor_pago)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={!item.foto_confirmacao}
                            onClick={() =>
                              setSelectedPhoto(
                                item.foto_confirmacao
                                  ? pb.files.getUrl(item, item.foto_confirmacao)
                                  : null,
                              )
                            }
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                          >
                            <ImageIcon className="h-4 w-4 mr-1" /> Foto
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className="md:hidden space-y-4">
            {loading ? (
              [...Array(3)].map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)
            ) : data.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <FileSearch className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <h3 className="text-lg font-medium">Nenhum pagamento</h3>
              </div>
            ) : (
              data.map((item) => {
                const { date, time } = formatDateTime(item.data_pagamento)
                const colab = item.expand?.colaborador_id
                return (
                  <Card key={item.id} className="overflow-hidden shadow-sm">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-semibold text-base text-slate-900 dark:text-slate-100">
                            {colab?.nome}
                          </div>
                          <div className="flex items-center text-xs text-muted-foreground mt-1">
                            <FileDigit className="h-3 w-3 mr-1" /> {colab?.registro}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-emerald-600">
                            {formatBRL(item.valor_pago)}
                          </div>
                          <div className="flex items-center justify-end text-xs text-muted-foreground mt-1">
                            <Building className="h-3 w-3 mr-1" /> {colab?.filial}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t">
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center">
                            <CalendarIcon className="h-3 w-3 mr-1" /> {date}
                          </span>
                          <span className="flex items-center">
                            <Clock className="h-3 w-3 mr-1" /> {time}
                          </span>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-8"
                          disabled={!item.foto_confirmacao}
                          onClick={() =>
                            setSelectedPhoto(
                              item.foto_confirmacao
                                ? pb.files.getUrl(item, item.foto_confirmacao)
                                : null,
                            )
                          }
                        >
                          <ImageIcon className="h-3 w-3 mr-1" /> Foto
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>

          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                Página {page} de {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Próxima <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={!!selectedPhoto} onOpenChange={(open) => !open && setSelectedPhoto(null)}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-950">
          <DialogHeader>
            <DialogTitle>Foto de Confirmação</DialogTitle>
          </DialogHeader>
          {selectedPhoto && (
            <div className="flex justify-center items-center p-2">
              <img
                src={selectedPhoto}
                alt="Confirmação"
                className="max-w-full max-h-[60vh] rounded-lg object-contain shadow-sm border"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
