import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from 'recharts'
import {
  Users,
  TrendingUp,
  DollarSign,
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Search,
  Inbox,
  Info,
  Image as ImageIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { getColaboradoresPaginated, getColaboradoresAnalytics } from '@/services/colaboradores'
import { useRealtime } from '@/hooks/use-realtime'
import { format, subDays } from 'date-fns'
import { Skeleton } from '@/components/ui/skeleton'
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination'
import { useToast } from '@/hooks/use-toast'
import { formatDataString, formatHoraString, formatBRL, getTipoPagamento } from '@/lib/formatters'

export default function Dashboard() {
  const { toast } = useToast()
  const [filters, setFilters] = useState({
    startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    filial: 'Todas',
    search: '',
    status: 'Todos',
    tipoPagamento: 'Todos',
  })
  const [debouncedFilters, setDebouncedFilters] = useState(filters)
  const [knownTipos, setKnownTipos] = useState<Set<number>>(new Set())
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [statsData, setStatsData] = useState<any[]>([])
  const [tableData, setTableData] = useState<any>(null)
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters((prev) => {
        if (JSON.stringify(prev) !== JSON.stringify(filters)) {
          setPage(1)
          return filters
        }
        return prev
      })
    }, 500)
    return () => clearTimeout(timer)
  }, [filters])

  const loadData = async () => {
    setLoading(true)
    setError(false)
    try {
      const [stats, paginated] = await Promise.all([
        getColaboradoresAnalytics(debouncedFilters),
        getColaboradoresPaginated(page, 20, debouncedFilters),
      ])
      setStatsData(stats)
      setTableData(paginated)
    } catch (e: any) {
      setError(true)
      toast({
        title: 'Erro de conexão',
        description: e.response?.message || 'Falha ao carregar os dados do dashboard.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [debouncedFilters, page])

  useEffect(() => {
    if (statsData.length > 0) {
      setKnownTipos((prev) => {
        const next = new Set(prev)
        statsData.forEach((c) => {
          if (c.idtipopgto != null) next.add(c.idtipopgto)
        })
        return next
      })
    }
  }, [statsData])

  const availableTipos = Array.from(knownTipos).sort()

  useRealtime('pagamentos', loadData)
  useRealtime('colaboradores', loadData)

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4 h-full">
        <AlertCircle className="h-12 w-12 text-rose-500" />
        <p className="text-lg font-medium">Erro ao carregar dados</p>
        <Button onClick={loadData} variant="outline">
          Tentar novamente
        </Button>
      </div>
    )
  }

  // Calculations
  const totalPago = statsData.reduce(
    (acc, curr) => acc + (curr.valor_a_receber || curr.valor || 0),
    0,
  )
  const uniqueColabs = new Set(statsData.map((c) => c.registro).filter(Boolean)).size
  const values = statsData.map((c) => c.valor_a_receber || c.valor || 0)
  const maxPago = values.length ? Math.max(...values) : 0
  const minPago = values.length ? Math.min(...values) : 0
  const avgPago = values.length ? totalPago / values.length : 0

  // Chart Data Preparation
  const pieDataMap = statsData.reduce(
    (acc, curr) => {
      const filial = curr.filial || 'Outra'
      acc[filial] = (acc[filial] || 0) + (curr.valor_a_receber || curr.valor || 0)
      return acc
    },
    {} as Record<string, number>,
  )

  const pieData = Object.entries(pieDataMap).map(([name, value]) => ({ name, value }))

  const dailyDataMap = statsData.reduce(
    (acc, curr) => {
      let dStr = ''
      if (curr.data_pagamento) {
        dStr = curr.data_pagamento.split(',')[0].trim()
      } else {
        dStr =
          formatDataString(curr.data) ||
          (curr.created ? format(new Date(curr.created), 'dd/MM/yyyy') : '')
      }

      if (!dStr || dStr === '-') return acc

      let dateKey = dStr
      if (dStr.includes('/')) {
        const p = dStr.split('/')
        dateKey = `${p[2]}-${p[1]}-${p[0]}`
      }

      acc[dateKey] = (acc[dateKey] || 0) + (curr.valor_a_receber || curr.valor || 0)
      return acc
    },
    {} as Record<string, number>,
  )

  const dailyData = Object.entries(dailyDataMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total]) => {
      const parts = date.split('-')
      return {
        date,
        formattedDate: parts.length === 3 ? `${parts[2]}/${parts[1]}` : date,
        total,
      }
    })

  const isEmpty = statsData.length === 0 && !loading

  // Group table items by Name without aggregating their values
  const groupedByName = (tableData?.items || []).reduce((acc: any, item: any) => {
    const n = item.nome || 'Desconhecido'
    if (!acc[n]) acc[n] = []
    acc[n].push(item)
    return acc
  }, {})

  return (
    <div className="container mx-auto py-8 px-4 space-y-8 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Painel do Gestor
          </h1>
          <p className="text-muted-foreground mt-1">
            Analise a distribuição de pagamentos e monitore as filiais.
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label>Buscar</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Busque por nome ou número de registro (RE).</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Nome ou registro..."
                className="pl-8"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label>Status</Label>
            </div>
            <Select
              value={filters.status}
              onValueChange={(val) => setFilters({ ...filters, status: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                <SelectItem value="Confirmado">Confirmado</SelectItem>
                <SelectItem value="Pendente">Pendente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label>Tipo</Label>
            </div>
            <Select
              value={filters.tipoPagamento}
              onValueChange={(val) => setFilters({ ...filters, tipoPagamento: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                {availableTipos.map((t) => (
                  <SelectItem key={t} value={String(t)}>
                    {getTipoPagamento(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label>Filial</Label>
            </div>
            <Select
              value={filters.filial}
              onValueChange={(val) => setFilters({ ...filters, filial: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todas">Ambas</SelectItem>
                <SelectItem value="Cursino">Cursino</SelectItem>
                <SelectItem value="Sapopemba">Sapopemba</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label>Data Inicial</Label>
            </div>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label>Data Final</Label>
            </div>
            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Pago</CardTitle>
            <DollarSign className="h-4 w-4 text-forest" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{formatBRL(totalPago)}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Qtd. Colaboradores</CardTitle>
            <Users className="h-4 w-4 text-forest" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{uniqueColabs}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Maior Valor</CardTitle>
            <ArrowUp className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{formatBRL(maxPago)}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Menor Valor</CardTitle>
            <ArrowDown className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{formatBRL(minPago)}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Média Paga</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{formatBRL(avgPago)}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {isEmpty ? (
        <Card className="flex flex-col items-center justify-center p-12">
          <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-muted-foreground">Nenhum dado encontrado</p>
        </Card>
      ) : (
        <>
          {/* Charts */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Total Pago por Dia</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : (
                  <ChartContainer
                    config={{ total: { label: 'Total Pago', color: 'hsl(var(--primary))' } }}
                    className="h-[300px] w-full"
                  >
                    <BarChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="formattedDate"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `R$${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v}`}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="total" fill="var(--color-total)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Distribuição por Filial</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : (
                  <ChartContainer
                    config={{
                      Cursino: { label: 'Cursino', color: 'hsl(var(--chart-1))' },
                      Sapopemba: { label: 'Sapopemba', color: 'hsl(var(--chart-2))' },
                      Outra: { label: 'Outra', color: 'hsl(var(--muted))' },
                    }}
                    className="h-[300px] w-full"
                  >
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        nameKey="name"
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={`var(--color-${entry.name})`} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Table */}
          <Card>
            <CardHeader>
              <CardTitle>Transações de Pagamentos</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <>
                  {/* Desktop View */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Colaborador</TableHead>
                          <TableHead>Registro</TableHead>
                          <TableHead>Filial</TableHead>
                          <TableHead className="text-right">Valor</TableHead>
                          <TableHead>Tipo de Pagamento</TableHead>
                          <TableHead>Data de Pagamento</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-center">Foto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.entries(groupedByName).map(([nome, records]: [string, any]) => {
                          const totalLines = statsData.filter(
                            (c) => (c.nome || 'Desconhecido') === nome,
                          ).length
                          return (
                            <React.Fragment key={nome}>
                              <TableRow className="bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                <TableCell
                                  colSpan={8}
                                  className="font-semibold text-slate-700 dark:text-slate-300"
                                >
                                  {nome} - {totalLines}{' '}
                                  {totalLines === 1 ? 'linha de pagamento' : 'linhas de pagamento'}
                                </TableCell>
                              </TableRow>
                              {records.map((p: any) => (
                                <TableRow key={p.id}>
                                  <TableCell className="font-medium pl-8">{p.nome}</TableCell>
                                  <TableCell>{p.registro}</TableCell>
                                  <TableCell>{p.filial}</TableCell>
                                  <TableCell className="text-right text-forest font-medium">
                                    {formatBRL(p.valor_a_receber || p.valor)}
                                  </TableCell>
                                  <TableCell>{getTipoPagamento(p.idtipopgto)}</TableCell>
                                  <TableCell>{p.data_pagamento || 'Pendente'}</TableCell>
                                  <TableCell>
                                    {(() => {
                                      const status =
                                        p.status ||
                                        (p.foto_confirmacao_url ? 'Confirmado' : 'Pendente')
                                      if (!status) return null
                                      if (status === 'Confirmado')
                                        return (
                                          <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white">
                                            Confirmado
                                          </Badge>
                                        )
                                      if (status === 'Pendente')
                                        return (
                                          <Badge className="bg-amber-500 hover:bg-amber-600 text-white">
                                            Pendente
                                          </Badge>
                                        )
                                      if (status === 'Cancelado')
                                        return <Badge variant="destructive">Cancelado</Badge>
                                      return <Badge variant="outline">{status}</Badge>
                                    })()}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    {p.foto_confirmacao_url && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSelectedPhotoUrl(p.foto_confirmacao_url)}
                                      >
                                        <ImageIcon className="w-4 h-4 mr-2" />
                                        Visualizar
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </React.Fragment>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile View */}
                  <div className="md:hidden space-y-6">
                    {Object.entries(groupedByName).map(([nome, records]: [string, any]) => {
                      const totalLines = statsData.filter(
                        (c) => (c.nome || 'Desconhecido') === nome,
                      ).length
                      return (
                        <div key={nome} className="space-y-4">
                          <div className="font-semibold text-slate-700 dark:text-slate-300 px-2 pt-2 border-b pb-2">
                            {nome} - {totalLines}{' '}
                            {totalLines === 1 ? 'linha de pagamento' : 'linhas de pagamento'}
                          </div>
                          {records.map((p: any) => (
                            <Card key={p.id} className="shadow-sm">
                              <CardContent className="p-4 flex flex-col gap-2">
                                <div className="flex justify-between font-bold">
                                  <span className="truncate">{p.nome}</span>
                                  <span className="text-forest">
                                    {formatBRL(p.valor_a_receber || p.valor)}
                                  </span>
                                </div>
                                <div className="text-sm text-muted-foreground flex justify-between">
                                  <span>Reg: {p.registro}</span>
                                  <span>{p.filial}</span>
                                </div>
                                <div className="text-sm text-muted-foreground flex justify-between">
                                  <span>{getTipoPagamento(p.idtipopgto)}</span>
                                </div>
                                <div className="text-sm text-muted-foreground flex justify-between">
                                  <span>Data de Pagamento:</span>
                                  <span>{p.data_pagamento || 'Pendente'}</span>
                                </div>
                                <div className="text-sm text-muted-foreground flex justify-between items-center mt-2 border-t pt-2">
                                  <div>
                                    {(() => {
                                      const status =
                                        p.status ||
                                        (p.foto_confirmacao_url ? 'Confirmado' : 'Pendente')
                                      if (!status) return null
                                      if (status === 'Confirmado')
                                        return (
                                          <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white">
                                            Confirmado
                                          </Badge>
                                        )
                                      if (status === 'Pendente')
                                        return (
                                          <Badge className="bg-amber-500 hover:bg-amber-600 text-white">
                                            Pendente
                                          </Badge>
                                        )
                                      if (status === 'Cancelado')
                                        return <Badge variant="destructive">Cancelado</Badge>
                                      return <Badge variant="outline">{status}</Badge>
                                    })()}
                                  </div>
                                  {p.foto_confirmacao_url && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setSelectedPhotoUrl(p.foto_confirmacao_url)}
                                    >
                                      <ImageIcon className="w-4 h-4 mr-2" />
                                      Foto
                                    </Button>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )
                    })}
                  </div>

                  {/* Pagination */}
                  {tableData?.totalPages > 1 && (
                    <div className="mt-4 flex justify-end">
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <Button
                              variant="ghost"
                              onClick={() => setPage((p) => Math.max(1, p - 1))}
                              disabled={page === 1}
                            >
                              Anterior
                            </Button>
                          </PaginationItem>
                          <PaginationItem>
                            <span className="text-sm text-muted-foreground px-4">
                              Página {page} de {tableData.totalPages}
                            </span>
                          </PaginationItem>
                          <PaginationItem>
                            <Button
                              variant="ghost"
                              onClick={() => setPage((p) => Math.min(tableData.totalPages, p + 1))}
                              disabled={page === tableData.totalPages}
                            >
                              Próxima
                            </Button>
                          </PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Dialog open={!!selectedPhotoUrl} onOpenChange={(open) => !open && setSelectedPhotoUrl(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Comprovante de Pagamento</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-900 rounded-md border">
            {selectedPhotoUrl && (
              <img
                src={selectedPhotoUrl}
                alt="Comprovante"
                className="max-w-full max-h-[70vh] object-contain rounded-md shadow-sm"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
