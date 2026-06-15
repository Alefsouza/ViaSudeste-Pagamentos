import React, { useState, useEffect, useMemo, useCallback } from 'react'
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
  FilterX,
  Trash2,
  Link as LinkIcon,
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
import { useRealtime } from '@/hooks/use-realtime'
import { format, subDays } from 'date-fns'
import { useAuth } from '@/hooks/use-auth'
import pb from '@/lib/pocketbase/client'
import { Skeleton } from '@/components/ui/skeleton'
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination'
import { Link } from 'react-router-dom'
import { useToast } from '@/hooks/use-toast'
import { formatBRL, getTipoPagamento } from '@/lib/formatters'

export default function Dashboard() {
  const { toast } = useToast()
  const { user } = useAuth()
  const isAlcimara = user?.email === 'alcimara.cabral@viasudeste.com'

  const [paymentToCancel, setPaymentToCancel] = useState<any>(null)
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

  const [statsLoading, setStatsLoading] = useState(true)
  const [tableLoading, setTableLoading] = useState(true)
  const [error, setError] = useState(false)

  const [statsData, setStatsData] = useState<any[]>([])
  const [colaboradoresStatsData, setColaboradoresStatsData] = useState<any[]>([])
  const [tableData, setTableData] = useState<any>(null)
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null)

  const [filialMap, setFilialMap] = useState<Map<string, number>>(new Map())
  const [filialIdToNameMap, setFilialIdToNameMap] = useState<Map<number, string>>(new Map())

  // Chart Interactive Filters
  const [selectedChartFilial, setSelectedChartFilial] = useState<string | null>(null)
  const [selectedChartDate, setSelectedChartDate] = useState<string | null>(null)

  useEffect(() => {
    const loadMaps = async () => {
      try {
        const colabRes = await pb.collection('colaboradores').getFullList({
          fields: 'filial,filial_id',
        })
        const mapStrToId = new Map<string, number>()
        const mapIdToStr = new Map<number, string>()
        colabRes.forEach((c: any) => {
          if (c.filial && c.filial_id != null) {
            mapStrToId.set(c.filial, c.filial_id)
            mapIdToStr.set(c.filial_id, c.filial)
          }
        })
        setFilialMap(mapStrToId)
        setFilialIdToNameMap(mapIdToStr)
      } catch {
        /* intentionally ignored */
      }
    }
    loadMaps()
  }, [])

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

  const buildPagamentosFilter = useCallback(
    (f: typeof filters) => {
      const conditions: string[] = []
      if (f.startDate && f.endDate) {
        conditions.push(
          `data_pagamento >= "${f.startDate} 00:00:00" && data_pagamento <= "${f.endDate} 23:59:59"`,
        )
      }
      if (f.search) {
        conditions.push(
          `(nome ~ "${f.search}" || registro ~ "${f.search}" || colaborador_id.nome ~ "${f.search}" || colaborador_id.registro ~ "${f.search}")`,
        )
      }
      if (f.status && f.status !== 'Todos') {
        if (f.status === 'Confirmado') {
          conditions.push(`(status = "Confirmado" || foto_confirmacao_url != "")`)
        } else if (f.status === 'Pendente') {
          conditions.push(`(status = "Pendente" || status = "")`)
        } else if (f.status === 'Cancelado') {
          conditions.push(`status = "Cancelado"`)
        }
      }
      if (f.tipoPagamento && f.tipoPagamento !== 'Todos') {
        conditions.push(
          `(tipo_pagamento = "${f.tipoPagamento}" || idtipopgto = ${f.tipoPagamento})`,
        )
      }
      if (f.filial && f.filial !== 'Todas') {
        const filialId = filialMap.get(f.filial)
        if (filialId !== undefined) {
          conditions.push(`(filial = ${filialId} || colaborador_id.filial = "${f.filial}")`)
        } else {
          conditions.push(`colaborador_id.filial = "${f.filial}"`)
        }
      }
      return conditions.length > 0 ? conditions.join(' && ') : ''
    },
    [filialMap],
  )

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    setError(false)
    try {
      const filterStr = buildPagamentosFilter(debouncedFilters)
      const stats = await pb.collection('pagamentos').getFullList({
        filter: filterStr,
        sort: '-data_pagamento',
        expand: 'colaborador_id',
      })

      const colabConditions: string[] = []
      if (debouncedFilters.startDate && debouncedFilters.endDate) {
        colabConditions.push(
          `(data_pagamento_v2 >= "${debouncedFilters.startDate} 00:00:00" && data_pagamento_v2 <= "${debouncedFilters.endDate} 23:59:59" || data_pagamento >= "${debouncedFilters.startDate}" && data_pagamento <= "${debouncedFilters.endDate}")`,
        )
      }
      if (debouncedFilters.search) {
        colabConditions.push(
          `(nome ~ "${debouncedFilters.search}" || registro ~ "${debouncedFilters.search}")`,
        )
      }
      if (debouncedFilters.filial && debouncedFilters.filial !== 'Todas') {
        const filialId = filialMap.get(debouncedFilters.filial)
        if (filialId !== undefined) {
          colabConditions.push(`(filial = "${debouncedFilters.filial}" || filial_id = ${filialId})`)
        } else {
          colabConditions.push(`filial = "${debouncedFilters.filial}"`)
        }
      }
      const colabFilter = colabConditions.length > 0 ? colabConditions.join(' && ') : ''
      const colabStats = await pb.collection('colaboradores').getFullList({
        filter: colabFilter,
      })

      setStatsData(stats)
      setColaboradoresStatsData(colabStats)
    } catch (e: any) {
      if (!e.isAbort) {
        setError(true)
        toast({
          title: 'Erro de conexão',
          description: e.response?.message || 'Falha ao carregar as estatísticas.',
          variant: 'destructive',
        })
      }
    } finally {
      setStatsLoading(false)
    }
  }, [debouncedFilters, buildPagamentosFilter, toast])

  const loadTable = useCallback(async () => {
    setTableLoading(true)
    try {
      const tableFiltersForAPI = { ...debouncedFilters }

      if (selectedChartFilial && selectedChartFilial !== 'Outra') {
        tableFiltersForAPI.filial = selectedChartFilial
      }

      if (selectedChartDate) {
        tableFiltersForAPI.startDate = selectedChartDate
        tableFiltersForAPI.endDate = selectedChartDate
      }

      const filterStr = buildPagamentosFilter(tableFiltersForAPI)
      const paginated = await pb.collection('pagamentos').getList(page, 20, {
        filter: filterStr,
        sort: '-created',
        expand: 'colaborador_id',
      })
      setTableData(paginated)
    } catch (e: any) {
      // Error handled in loadStats
    } finally {
      setTableLoading(false)
    }
  }, [debouncedFilters, page, selectedChartFilial, selectedChartDate, buildPagamentosFilter])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  useEffect(() => {
    loadTable()
  }, [loadTable])

  const refreshAll = useCallback(() => {
    loadStats()
    loadTable()
  }, [loadStats, loadTable])

  const handleCancelPayment = async () => {
    if (!paymentToCancel) return
    try {
      await pb.collection('pagamentos').update(paymentToCancel.id, { status: 'Cancelado' })
      toast({ title: 'Pagamento cancelado com sucesso.' })
      setPaymentToCancel(null)
      refreshAll()
    } catch (err: any) {
      toast({
        title: 'Erro ao cancelar o pagamento. Tente novamente.',
        variant: 'destructive',
      })
    }
  }

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

  useRealtime('pagamentos', refreshAll)

  const availableTipos = Array.from(knownTipos).sort()

  const getFilialName = useCallback(
    (curr: any) => {
      if (!curr) return 'Outra'
      const fromRel = curr?.expand?.colaborador_id?.filial
      if (fromRel) return fromRel
      if (curr.filial != null && filialIdToNameMap.has(curr.filial)) {
        return filialIdToNameMap.get(curr.filial)
      }
      return 'Outra'
    },
    [filialIdToNameMap],
  )

  const filteredStatsData = useMemo(() => {
    return statsData.filter((curr) => {
      if (selectedChartFilial) {
        const f = getFilialName(curr)
        if (f !== selectedChartFilial) return false
      }

      if (selectedChartDate) {
        const dStr = curr.data_pagamento ? curr.data_pagamento.split(' ')[0] : '-'
        if (dStr !== selectedChartDate) return false
      }

      return true
    })
  }, [statsData, selectedChartFilial, selectedChartDate, getFilialName])

  const filteredColaboradoresStatsData = useMemo(() => {
    return colaboradoresStatsData.filter((curr) => {
      if (selectedChartFilial) {
        const f = curr.filial || 'Outra'
        if (f !== selectedChartFilial) return false
      }

      if (selectedChartDate) {
        const dStr = curr.data_pagamento_v2
          ? curr.data_pagamento_v2.split(' ')[0]
          : curr.data_pagamento
            ? curr.data_pagamento.split(' ')[0]
            : '-'
        if (dStr !== selectedChartDate) return false
      }

      return true
    })
  }, [colaboradoresStatsData, selectedChartFilial, selectedChartDate])

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 space-y-4 h-full">
        <AlertCircle className="h-12 w-12 text-rose-500" />
        <p className="text-lg font-medium">Erro ao carregar dados</p>
        <Button onClick={refreshAll} variant="outline">
          Tentar novamente
        </Button>
      </div>
    )
  }

  // Calculations
  const confirmados = filteredColaboradoresStatsData.filter(
    (c) => c.foto_confirmacao_url && c.foto_confirmacao_url.trim() !== '',
  )
  const uniqueColabs = confirmados.length
  const values = confirmados.map((c) => c.valor_a_receber || c.valor || 0)
  const maxPago = values.length ? Math.max(...values) : 0
  const minPago = values.length ? Math.min(...values) : 0

  const pagamentosTotals = {
    pago: values.reduce((a, b) => a + b, 0),
    pendente: filteredColaboradoresStatsData
      .filter((c) => !c.foto_confirmacao_url || c.foto_confirmacao_url.trim() === '')
      .reduce((acc, curr) => acc + (curr.valor_a_receber || curr.valor || 0), 0),
  }

  const avgPago = values.length ? pagamentosTotals.pago / values.length : 0

  const pieDataMap = colaboradoresStatsData.reduce(
    (acc, curr) => {
      const isConfirmado = curr.foto_confirmacao_url && curr.foto_confirmacao_url.trim() !== ''
      if (!isConfirmado) return acc
      const filial = curr.filial || 'Outra'
      acc[filial] = (acc[filial] || 0) + (curr.valor_a_receber || curr.valor || 0)
      return acc
    },
    {} as Record<string, number>,
  )

  const pieData = Object.entries(pieDataMap).map(([name, value]) => ({ name, value }))

  const dailyDataMap = colaboradoresStatsData.reduce(
    (acc, curr) => {
      const isConfirmado = curr.foto_confirmacao_url && curr.foto_confirmacao_url.trim() !== ''
      if (!isConfirmado) return acc

      const dStr = curr.data_pagamento_v2
        ? curr.data_pagamento_v2.split(' ')[0]
        : curr.data_pagamento
          ? curr.data_pagamento.split(' ')[0]
          : '-'
      if (dStr === '-') return acc

      acc[dStr] = (acc[dStr] || 0) + (curr.valor_a_receber || curr.valor || 0)
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

  const isEmpty = statsData.length === 0 && !statsLoading

  const groupedByName = (tableData?.items || []).reduce((acc: any, item: any) => {
    if (!item) return acc
    const n = item?.expand?.colaborador_id?.nome || item?.nome || 'Desconhecido'
    if (!acc[n]) acc[n] = []
    acc[n].push(item)
    return acc
  }, {})

  const formatDateStringSafe = (dateStr: string) => {
    if (!dateStr || dateStr === '-') return '-'
    if (dateStr.includes('/')) return dateStr
    if (dateStr.includes('-')) {
      const parts = dateStr.split(' ')[0].split('-')
      if (parts.length >= 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
    }
    return dateStr
  }

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
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/gestao-registros">
              <LinkIcon className="h-4 w-4 mr-2" /> Gestão de Órfãos
            </Link>
          </Button>
          {(selectedChartFilial || selectedChartDate) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedChartFilial(null)
                setSelectedChartDate(null)
                setPage(1)
              }}
              className="animate-fade-in text-muted-foreground"
            >
              <FilterX className="h-4 w-4 mr-2" />
              Limpar Filtros
            </Button>
          )}
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
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Pago</CardTitle>
            <DollarSign className="h-4 w-4 text-forest" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold transition-all duration-300">
                {formatBRL(pagamentosTotals.pago)}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Valor a Pagar</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold transition-all duration-300">
                {formatBRL(pagamentosTotals.pendente)}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Qtd. Colaboradores</CardTitle>
            <Users className="h-4 w-4 text-forest" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold transition-all duration-300">{uniqueColabs}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Maior Valor (Pago)</CardTitle>
            <ArrowUp className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold transition-all duration-300">
                {formatBRL(maxPago)}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Menor Valor (Pago)</CardTitle>
            <ArrowDown className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold transition-all duration-300">
                {formatBRL(minPago)}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Média Paga</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold transition-all duration-300">
                {formatBRL(avgPago)}
              </div>
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
                {statsLoading ? (
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
                      <Bar
                        dataKey="total"
                        radius={[4, 4, 0, 0]}
                        onClick={(data) => {
                          const date = data?.date || data?.payload?.date
                          if (date) {
                            setSelectedChartDate((prev) => (prev === date ? null : date))
                            setPage(1)
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        {dailyData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill="var(--color-total)"
                            style={{
                              opacity: selectedChartDate
                                ? selectedChartDate === entry.date
                                  ? 1
                                  : 0.3
                                : 1,
                              transition: 'opacity 0.2s',
                              outline: 'none',
                            }}
                          />
                        ))}
                      </Bar>
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
                {statsLoading ? (
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
                        onClick={(data) => {
                          const name = data?.name || data?.payload?.name
                          if (name) {
                            setSelectedChartFilial((prev) => (prev === name ? null : name))
                            setPage(1)
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        {pieData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={`var(--color-${entry.name})`}
                            style={{
                              opacity: selectedChartFilial
                                ? selectedChartFilial === entry.name
                                  ? 1
                                  : 0.3
                                : 1,
                              transition: 'opacity 0.2s',
                              outline: 'none',
                            }}
                          />
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
              <CardTitle>
                Transações de Pagamentos
                {(selectedChartFilial || selectedChartDate) && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    (Filtro de gráfico ativo)
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tableLoading ? (
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
                          <TableHead className="text-left">Valor</TableHead>
                          <TableHead>Tipo de Pagamento</TableHead>
                          <TableHead>Data de Pagamento</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-center">Foto</TableHead>
                          {isAlcimara && <TableHead className="text-center">Ações</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.keys(groupedByName).length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={isAlcimara ? 9 : 8}
                              className="h-24 text-center text-muted-foreground"
                            >
                              Nenhum pagamento encontrado com os filtros atuais.
                            </TableCell>
                          </TableRow>
                        ) : (
                          Object.entries(groupedByName).map(([nome, records]: [string, any]) => {
                            const totalLines = filteredStatsData.filter(
                              (c) =>
                                (c?.expand?.colaborador_id?.nome || c?.nome || 'Desconhecido') ===
                                nome,
                            ).length
                            return (
                              <React.Fragment key={nome}>
                                <TableRow className="bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                  <TableCell
                                    colSpan={isAlcimara ? 9 : 8}
                                    className="font-semibold text-slate-700 dark:text-slate-300"
                                  >
                                    {nome} - {totalLines}{' '}
                                    {totalLines === 1
                                      ? 'linha de pagamento'
                                      : 'linhas de pagamento'}
                                  </TableCell>
                                </TableRow>
                                {records.map((p: any) => (
                                  <TableRow key={p.id}>
                                    <TableCell className="font-medium pl-8">
                                      {p?.expand?.colaborador_id?.nome || p?.nome || 'Desconhecido'}
                                    </TableCell>
                                    <TableCell>
                                      {p?.expand?.colaborador_id?.registro || p?.registro || 'N/A'}
                                    </TableCell>
                                    <TableCell>{getFilialName(p)}</TableCell>
                                    <TableCell className="text-forest font-medium text-left">
                                      {formatBRL(p.valor_pago || p.valor_a_receber || p.valor || 0)}
                                    </TableCell>
                                    <TableCell>
                                      {getTipoPagamento(p.idtipopgto) || p.tipo_pagamento}
                                    </TableCell>
                                    <TableCell>
                                      {formatDateStringSafe(p.data_pagamento) || 'Pendente'}
                                    </TableCell>
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
                                          onClick={() =>
                                            setSelectedPhotoUrl(p.foto_confirmacao_url)
                                          }
                                        >
                                          <ImageIcon className="w-4 h-4 mr-2" />
                                          Visualizar
                                        </Button>
                                      )}
                                    </TableCell>
                                    {isAlcimara && (
                                      <TableCell className="text-center">
                                        {(() => {
                                          const status =
                                            p.status ||
                                            (p.foto_confirmacao_url ? 'Confirmado' : 'Pendente')
                                          if (status === 'Pendente') {
                                            return (
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-rose-500 hover:text-rose-700 hover:bg-rose-100 dark:hover:bg-rose-900/50"
                                                onClick={() => setPaymentToCancel(p)}
                                                title="Cancelar Pagamento"
                                              >
                                                <Trash2 className="h-4 w-4" />
                                              </Button>
                                            )
                                          }
                                          return null
                                        })()}
                                      </TableCell>
                                    )}
                                  </TableRow>
                                ))}
                              </React.Fragment>
                            )
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile View */}
                  <div className="md:hidden space-y-6">
                    {Object.keys(groupedByName).length === 0 ? (
                      <div className="text-center text-muted-foreground p-8">
                        Nenhum pagamento encontrado.
                      </div>
                    ) : (
                      Object.entries(groupedByName).map(([nome, records]: [string, any]) => {
                        const totalLines = filteredStatsData.filter(
                          (c) =>
                            (c?.expand?.colaborador_id?.nome || c?.nome || 'Desconhecido') === nome,
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
                                    <span className="truncate">
                                      {p?.expand?.colaborador_id?.nome || p?.nome || 'Desconhecido'}
                                    </span>
                                    <span className="text-forest">
                                      {formatBRL(
                                        p?.valor_pago || p?.valor_a_receber || p?.valor || 0,
                                      )}
                                    </span>
                                  </div>
                                  <div className="text-sm text-muted-foreground flex justify-between">
                                    <span>
                                      Reg:{' '}
                                      {p?.expand?.colaborador_id?.registro || p?.registro || 'N/A'}
                                    </span>
                                    <span>{getFilialName(p)}</span>
                                  </div>
                                  <div className="text-sm text-muted-foreground flex justify-between">
                                    <span>
                                      {getTipoPagamento(p.idtipopgto) || p.tipo_pagamento}
                                    </span>
                                  </div>
                                  <div className="text-sm text-muted-foreground flex justify-between">
                                    <span>Data de Pagamento:</span>
                                    <span>
                                      {formatDateStringSafe(p.data_pagamento) || 'Pendente'}
                                    </span>
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
                                    <div className="flex gap-2">
                                      {p.foto_confirmacao_url && (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() =>
                                            setSelectedPhotoUrl(p.foto_confirmacao_url)
                                          }
                                        >
                                          <ImageIcon className="w-4 h-4 mr-2" />
                                          Foto
                                        </Button>
                                      )}
                                      {isAlcimara &&
                                        (() => {
                                          const status =
                                            p.status ||
                                            (p.foto_confirmacao_url ? 'Confirmado' : 'Pendente')
                                          if (status === 'Pendente') {
                                            return (
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-rose-500 hover:text-rose-700 hover:bg-rose-100 dark:hover:bg-rose-900/50 px-2"
                                                onClick={() => setPaymentToCancel(p)}
                                                title="Cancelar Pagamento"
                                              >
                                                <Trash2 className="h-4 w-4 mr-2" />
                                                Cancelar
                                              </Button>
                                            )
                                          }
                                          return null
                                        })()}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )
                      })
                    )}
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

      <Dialog open={!!paymentToCancel} onOpenChange={(open) => !open && setPaymentToCancel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p>Tem certeza que deseja cancelar este pagamento?</p>
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-md space-y-2 text-sm border">
              <div className="flex justify-between">
                <span className="font-semibold text-muted-foreground">Colaborador:</span>
                <span>
                  {paymentToCancel?.expand?.colaborador_id?.nome || paymentToCancel?.nome}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-muted-foreground">Valor:</span>
                <span className="text-forest font-medium">
                  {paymentToCancel
                    ? formatBRL(
                        paymentToCancel.valor_pago ||
                          paymentToCancel.valor_a_receber ||
                          paymentToCancel.valor ||
                          0,
                      )
                    : ''}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-muted-foreground">Data de Pagamento:</span>
                <span>{formatDateStringSafe(paymentToCancel?.data_pagamento) || 'Pendente'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-muted-foreground">Filial:</span>
                <span>{getFilialName(paymentToCancel)}</span>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPaymentToCancel(null)}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={handleCancelPayment}>
              Confirmar Cancelamento
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
