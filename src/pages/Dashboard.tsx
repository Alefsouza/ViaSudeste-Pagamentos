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
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
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
  Unlock,
  Lock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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
import { useAuth } from '@/hooks/use-auth'
import pb from '@/lib/pocketbase/client'
import { Skeleton } from '@/components/ui/skeleton'
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination'
import { useToast } from '@/hooks/use-toast'
import {
  formatDataString,
  formatBRL,
  getTipoPagamento,
  checkIsLocked,
  formatDateDBToBR,
} from '@/lib/formatters'

export const getEvaluatedStatus = (curr: any, maxRef: number) => {
  let status =
    curr.pagStatus || curr.status || (curr.foto_confirmacao_url ? 'Confirmado' : 'Pendente')

  const hasPhoto = !!(
    curr.foto_confirmacao_url ||
    curr.foto_confirmacao ||
    curr.expand?.colaborador_id?.foto_confirmacao_url
  )

  if (status === 'Confirmado' && !hasPhoto) {
    status = 'Pendente'
  }

  if (status === 'Pendente' && curr.pagStatus !== 'Pendente') {
    const isLocked = checkIsLocked(curr.data_liberacao)
    const ref = curr.referencia || 0
    const isOutsideWindow = ref > 0 && maxRef > 0 && ref < maxRef - 3

    if (isLocked) {
      status = 'Agendado'
    } else if (isOutsideWindow && !curr.liberado_pagamento) {
      status = 'Bloqueado'
    }
  }

  return status
}

const formatLocalTime = (dateStr: string) => {
  if (!dateStr || dateStr === 'Pendente' || dateStr === '-' || dateStr === '') return dateStr
  let cleanStr = dateStr
  if (cleanStr.includes(' ') && !cleanStr.includes('T')) cleanStr = cleanStr.replace(' ', 'T')
  if (
    !cleanStr.endsWith('Z') &&
    cleanStr.split('T').length === 2 &&
    !cleanStr.includes('+') &&
    !cleanStr.match(/-\d{2}:\d{2}$/)
  )
    cleanStr += 'Z'
  const d = new Date(cleanStr)
  if (isNaN(d.getTime())) return dateStr

  const utcMinus3 = new Date(d.getTime() - 3 * 3600000)
  const dd = String(utcMinus3.getUTCDate()).padStart(2, '0')
  const mm = String(utcMinus3.getUTCMonth() + 1).padStart(2, '0')
  const yyyy = utcMinus3.getUTCFullYear()
  const hh = String(utcMinus3.getUTCHours()).padStart(2, '0')
  const mins = String(utcMinus3.getUTCMinutes()).padStart(2, '0')
  const ss = String(utcMinus3.getUTCSeconds()).padStart(2, '0')

  return `${dd}/${mm}/${yyyy} ${hh}:${mins}:${ss}`
}

export default function Dashboard() {
  const { toast } = useToast()
  const { user } = useAuth()
  const isAdmin = user?.role === 'Administrador'

  const [paymentToCancel, setPaymentToCancel] = useState<any>(null)
  const [maxRef, setMaxRef] = useState<number>(0)
  const [filters, setFilters] = useState({
    startDate: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    filial: 'Todas',
    search: '',
    status: 'Todos',
    tipoPagamento: 'Todos',
    referencia: 'Todas',
  })
  const [debouncedFilters, setDebouncedFilters] = useState(filters)
  const [knownTipos, setKnownTipos] = useState<Set<number>>(new Set())
  const [knownRefs, setKnownRefs] = useState<Set<number>>(new Set())
  const [page, setPage] = useState(1)

  const [statsLoading, setStatsLoading] = useState(true)
  const [tableLoading, setTableLoading] = useState(true)
  const [error, setError] = useState(false)

  const [statsData, setStatsData] = useState<any[]>([])
  const [tableData, setTableData] = useState<any>(null)
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null)

  // Chart Interactive Filters
  const [selectedChartFilial, setSelectedChartFilial] = useState<string | null>(null)
  const [selectedChartDate, setSelectedChartDate] = useState<string | null>(null)
  const [selectedChartRef, setSelectedChartRef] = useState<string | null>(null)
  const [chartRefSearch, setChartRefSearch] = useState('')

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

  const loadStats = async () => {
    setStatsLoading(true)
    setError(false)
    try {
      const stats = await getColaboradoresAnalytics(debouncedFilters)
      setStatsData(stats)
    } catch (e: any) {
      setError(true)
      toast({
        title: 'Erro de conexão',
        description: e.response?.message || 'Falha ao carregar as estatísticas.',
        variant: 'destructive',
      })
    } finally {
      setStatsLoading(false)
    }
  }

  const loadTable = async () => {
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

      if (selectedChartRef && selectedChartRef !== 'N/A') {
        tableFiltersForAPI.referencia = selectedChartRef
      }

      const paginated = await getColaboradoresPaginated(page, 20, tableFiltersForAPI)
      setTableData(paginated)
    } catch (e: any) {
      // Error is caught by loadStats generally, preventing double toast
    } finally {
      setTableLoading(false)
    }
  }

  useEffect(() => {
    loadStats()
  }, [debouncedFilters])

  const loadMaxRef = async () => {
    try {
      const rec = await pb
        .collection('colaboradores')
        .getFirstListItem('referencia > 0', { sort: '-referencia', fields: 'referencia' })
      setMaxRef(rec.referencia || 0)
    } catch (e) {
      setMaxRef(0)
    }
  }

  useEffect(() => {
    loadMaxRef()
  }, [])

  useEffect(() => {
    loadTable()
  }, [
    debouncedFilters,
    page,
    selectedChartFilial,
    selectedChartDate,
    selectedChartRef,
    chartRefSearch,
  ])

  const refreshAll = useCallback(() => {
    loadStats()
    loadTable()
    loadMaxRef()
  }, [
    debouncedFilters,
    page,
    selectedChartFilial,
    selectedChartDate,
    selectedChartRef,
    chartRefSearch,
  ])

  const handleToggleRelease = async (payment: any) => {
    try {
      const newStatus = !payment.liberado_pagamento
      await pb.collection('colaboradores').update(payment.id, { liberado_pagamento: newStatus })
      toast({
        title: newStatus ? 'Pagamento liberado com sucesso.' : 'Pagamento bloqueado com sucesso.',
      })
      refreshAll()
    } catch (err: any) {
      toast({
        title: 'Erro ao alterar o status do pagamento. Tente novamente.',
        variant: 'destructive',
      })
    }
  }

  const handleDeletePayment = async () => {
    if (!paymentToCancel) return
    try {
      const colabId = paymentToCancel.id

      const pagamentos = await pb.collection('pagamentos').getFullList({
        filter: `colaborador_id = "${colabId}"`,
      })

      for (const pag of pagamentos) {
        await pb.collection('pagamentos').delete(pag.id)
      }

      await pb.collection('colaboradores').delete(colabId)

      toast({ title: 'Registro e pagamentos associados excluídos com sucesso!' })
      setPaymentToCancel(null)
      refreshAll()
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir o registro. Por favor, tente novamente.',
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
      setKnownRefs((prev) => {
        const next = new Set(prev)
        statsData.forEach((c) => {
          if (c.referencia != null) next.add(c.referencia)
        })
        return next
      })
    }
  }, [statsData])

  useRealtime('pagamentos', refreshAll)
  useRealtime('colaboradores', refreshAll)
  useRealtime('fotos_colaboradores', refreshAll)

  const availableTipos = Array.from(knownTipos).sort()
  const availableRefs = Array.from(knownRefs).sort((a, b) => b - a)

  // Derived filtered stats for Summary Cards based on interactive chart selections
  const filteredStatsData = useMemo(() => {
    return statsData.filter((curr) => {
      if (selectedChartFilial && (curr.filial || 'Outra') !== selectedChartFilial) return false

      if (selectedChartRef) {
        const cRef = curr.referencia ? String(curr.referencia) : 'N/A'
        if (cRef !== selectedChartRef) return false
      }

      if (chartRefSearch) {
        const cRef = curr.referencia ? String(curr.referencia) : 'N/A'
        if (!cRef.toLowerCase().includes(chartRefSearch.toLowerCase())) return false
      }

      if (selectedChartDate) {
        let dateKey: string | null = null
        if (
          curr.data_pagamento &&
          curr.data_pagamento.trim() !== '-' &&
          curr.data_pagamento.trim() !== ''
        ) {
          let str = curr.data_pagamento.trim()
          if (str.includes('T')) str = str.split('T')[0]
          else if (str.includes(' ')) str = str.split(' ')[0]
          else if (str.includes(',')) str = str.split(',')[0].trim()

          if (str.match(/^\d{4}-\d{2}-\d{2}$/)) {
            dateKey = str
          } else if (str.includes('/')) {
            const parts = str.split('/')
            if (parts.length === 3) {
              if (parts[2].length === 4)
                dateKey = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
              else if (parts[0].length === 4)
                dateKey = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
              else dateKey = str
            } else {
              dateKey = str
            }
          } else {
            dateKey = str
          }
        }

        if (!dateKey || dateKey !== selectedChartDate) return false
      }

      return true
    })
  }, [statsData, selectedChartFilial, selectedChartDate, selectedChartRef, chartRefSearch])

  const pagamentosTotals = useMemo(() => {
    return filteredStatsData.reduce(
      (acc, curr) => {
        const val = curr.valor_a_receber || curr.valor || 0
        let status = getEvaluatedStatus(curr, maxRef)

        let acronym = ''
        const tipoNome = getTipoPagamento(curr.idtipopgto) || ''
        const lowerTipo = typeof tipoNome === 'string' ? tipoNome.toLowerCase() : ''

        if (curr.idtipopgto === 1 || lowerTipo.includes('hora') || lowerTipo.includes('he'))
          acronym = 'HE'
        else if (
          curr.idtipopgto === 2 ||
          lowerTipo.includes('vale') ||
          lowerTipo.includes('vr') ||
          lowerTipo.includes('refeição') ||
          lowerTipo.includes('refeicao')
        )
          acronym = 'VR'
        else if (
          curr.idtipopgto === 3 ||
          lowerTipo.includes('férias') ||
          lowerTipo.includes('ferias') ||
          lowerTipo.includes('ft')
        )
          acronym = 'FT'

        if (status === 'Confirmado') {
          acc.pago += val
          if (acronym === 'HE') acc.pagoHE += val
          if (acronym === 'VR') acc.pagoVR += val
          if (acronym === 'FT') acc.pagoFT += val
        } else if (status === 'Pendente') {
          acc.pendente += val
          if (acronym === 'HE') acc.pendenteHE += val
          if (acronym === 'VR') acc.pendenteVR += val
          if (acronym === 'FT') acc.pendenteFT += val
        }
        return acc
      },
      {
        pago: 0,
        pendente: 0,
        pagoVR: 0,
        pagoHE: 0,
        pagoFT: 0,
        pendenteVR: 0,
        pendenteHE: 0,
        pendenteFT: 0,
      },
    )
  }, [filteredStatsData])

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
  const uniqueColabs = new Set(
    filteredStatsData
      .filter((c) => {
        let status = getEvaluatedStatus(c, maxRef)
        return status !== 'Agendado' && status !== 'Cancelado' && status !== 'Bloqueado'
      })
      .map((c) => c.registro || c.expand?.colaborador_id?.registro)
      .filter(Boolean),
  ).size

  const confirmedPayments = filteredStatsData.filter((c) => {
    let status = getEvaluatedStatus(c, maxRef)
    return status === 'Confirmado'
  })

  const confirmedValues = confirmedPayments.map(
    (c) => c.valor_pago || c.valor_a_receber || c.valor || 0,
  )
  const maxPago = confirmedValues.length ? Math.max(...confirmedValues) : 0
  const minPago = confirmedValues.length ? Math.min(...confirmedValues) : 0
  const avgPago = confirmedValues.length ? pagamentosTotals.pago / confirmedValues.length : 0

  // Chart Data Preparation (using full statsData so context remains visible)
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
      const status = curr.status || (curr.foto_confirmacao_url ? 'Confirmado' : 'Pendente')
      if (status !== 'Confirmado') return acc

      let dateKey: string | null = null
      if (
        curr.data_pagamento &&
        curr.data_pagamento.trim() !== '-' &&
        curr.data_pagamento.trim() !== ''
      ) {
        let str = curr.data_pagamento.trim()
        if (str.includes('T')) str = str.split('T')[0]
        else if (str.includes(' ')) str = str.split(' ')[0]
        else if (str.includes(',')) str = str.split(',')[0].trim()

        if (str.match(/^\d{4}-\d{2}-\d{2}$/)) {
          dateKey = str
        } else if (str.includes('/')) {
          const parts = str.split('/')
          if (parts.length === 3) {
            if (parts[2].length === 4)
              dateKey = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
            else if (parts[0].length === 4)
              dateKey = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
            else dateKey = str
          } else {
            dateKey = str
          }
        } else {
          dateKey = str
        }
      }

      if (!dateKey) return acc

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
        formattedDate: parts.length >= 3 ? `${parts[2]}/${parts[1]}` : date,
        total,
      }
    })

  const refDataMap = statsData.reduce(
    (acc, curr) => {
      const ref = curr.referencia ? String(curr.referencia) : 'N/A'
      if (chartRefSearch && !ref.toLowerCase().includes(chartRefSearch.toLowerCase())) {
        return acc
      }
      if (!acc[ref]) {
        acc[ref] = { total: 0, periodo_inicio: null, periodo_fim: null }
      }
      acc[ref].total += curr.valor_a_receber || curr.valor || 0

      if (!acc[ref].periodo_inicio) {
        acc[ref].periodo_inicio =
          curr.periodo_inicio || curr.expand?.colaborador_id?.periodo_inicio || null
      }
      if (!acc[ref].periodo_fim) {
        acc[ref].periodo_fim = curr.periodo_fim || curr.expand?.colaborador_id?.periodo_fim || null
      }

      return acc
    },
    {} as Record<
      string,
      { total: number; periodo_inicio: string | null; periodo_fim: string | null }
    >,
  )

  const refData = Object.entries(refDataMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ref, data]) => ({
      referenciaName: ref,
      total: data.total,
      periodo_inicio: data.periodo_inicio,
      periodo_fim: data.periodo_fim,
    }))

  const isEmpty = statsData.length === 0 && !statsLoading

  // Group table items by Reference without aggregating their values
  const groupedByRef = (tableData?.items || []).reduce((acc: any, item: any) => {
    const ref = item.referencia ?? item.expand?.colaborador_id?.referencia
    const refStr = ref != null ? `Referência: ${ref}` : 'Sem Referência'
    if (!acc[refStr]) acc[refStr] = []
    acc[refStr].push(item)
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
        {(selectedChartFilial || selectedChartDate || selectedChartRef || chartRefSearch) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSelectedChartFilial(null)
              setSelectedChartDate(null)
              setSelectedChartRef(null)
              setChartRefSearch('')
              setPage(1)
            }}
            className="animate-fade-in text-muted-foreground"
          >
            <FilterX className="h-4 w-4 mr-2" />
            Limpar Filtros de Gráfico
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-4 *:flex-1 *:min-w-[140px]">
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label>Buscar</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
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
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label>Referência</Label>
            </div>
            <Input
              type="number"
              placeholder="Todas"
              value={filters.referencia === 'Todas' ? '' : filters.referencia}
              onChange={(e) => setFilters({ ...filters, referencia: e.target.value || 'Todas' })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-8 items-stretch">
        <Card className="lg:col-span-2 flex flex-col h-full">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Pago</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="flex flex-col h-full space-y-1">
                <div className="text-2xl font-bold transition-all duration-300">
                  {formatBRL(pagamentosTotals.pago)}
                </div>
                <div className="flex flex-col text-[11px] md:text-xs text-muted-foreground leading-tight mt-auto space-y-0.5 pt-1 border-t border-border/50">
                  <span>VR: {formatBRL(pagamentosTotals.pagoVR)}</span>
                  <span>HE: {formatBRL(pagamentosTotals.pagoHE)}</span>
                  <span>FT: {formatBRL(pagamentosTotals.pagoFT)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2 flex flex-col h-full">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Valor a Pagar</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent className="flex-1 flex flex-col">
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="flex flex-col h-full space-y-1">
                <div className="text-2xl font-bold transition-all duration-300">
                  {formatBRL(pagamentosTotals.pendente)}
                </div>
                <div className="flex flex-col text-[11px] md:text-xs text-muted-foreground leading-tight mt-auto space-y-0.5 pt-1 border-t border-border/50">
                  <span>VR: {formatBRL(pagamentosTotals.pendenteVR)}</span>
                  <span>HE: {formatBRL(pagamentosTotals.pendenteHE)}</span>
                  <span>FT: {formatBRL(pagamentosTotals.pendenteFT)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="flex flex-col h-full">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Qtd. Colaboradores</CardTitle>
            <Users className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent className="flex-1">
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold transition-all duration-300">{uniqueColabs}</div>
            )}
          </CardContent>
        </Card>
        <Card className="flex flex-col h-full">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Maior Valor</CardTitle>
            <ArrowUp className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent className="flex-1">
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold transition-all duration-300">
                {formatBRL(maxPago)}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="flex flex-col h-full">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Menor Valor</CardTitle>
            <ArrowDown className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent className="flex-1">
            {statsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold transition-all duration-300">
                {formatBRL(minPago)}
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="flex flex-col h-full">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Média Paga</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent className="flex-1">
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
          <div className="grid gap-4 md:grid-cols-2 mb-4">
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

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle>Distribuição por Referência</CardTitle>
                <div className="relative w-32 md:w-40">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar ref..."
                    className="pl-8 h-9 text-sm"
                    value={chartRefSearch}
                    onChange={(e) => setChartRefSearch(e.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : (
                  <ChartContainer
                    config={{ total: { label: 'Total', color: '#22c55e' } }}
                    className="h-[300px] w-full"
                  >
                    <BarChart data={refData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="referenciaName"
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
                      <ChartTooltip
                        cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload

                            return (
                              <div className="rounded-lg border bg-background p-3 shadow-md text-sm space-y-1 min-w-[220px]">
                                <div className="font-medium text-foreground mb-2 pb-1 border-b">
                                  Período da Referência: {data.referenciaName}
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-muted-foreground">Data Início:</span>
                                  <span className="font-medium">
                                    {formatDateDBToBR(data.periodo_inicio)}
                                  </span>
                                </div>
                                <div className="flex justify-between gap-4">
                                  <span className="text-muted-foreground">Data Final:</span>
                                  <span className="font-medium">
                                    {formatDateDBToBR(data.periodo_fim)}
                                  </span>
                                </div>
                                <div className="flex justify-between gap-4 pt-1 mt-1 border-t">
                                  <span className="text-muted-foreground">Total Pago:</span>
                                  <span className="font-bold text-emerald-600 dark:text-emerald-500">
                                    {formatBRL(data.total)}
                                  </span>
                                </div>
                              </div>
                            )
                          }
                          return null
                        }}
                      />
                      <Bar
                        dataKey="total"
                        radius={[4, 4, 0, 0]}
                        fill="var(--color-total)"
                        onClick={(data) => {
                          const refVal = data?.referenciaName || data?.payload?.referenciaName
                          if (refVal) {
                            setSelectedChartRef((prev) => (prev === refVal ? null : refVal))
                            setPage(1)
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        {refData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill="var(--color-total)"
                            style={{
                              opacity: selectedChartRef
                                ? selectedChartRef === entry.referenciaName
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
          </div>

          <div className="grid gap-4 grid-cols-1 mb-4">
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
                    <LineChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                      <Line
                        type="monotone"
                        dataKey="total"
                        stroke="var(--color-total)"
                        strokeWidth={2}
                        dot={{ r: 4, fill: 'var(--color-total)', strokeWidth: 2 }}
                        activeDot={{
                          r: 6,
                          onClick: (_e: any, payload: any) => {
                            const date = payload?.payload?.date
                            if (date) {
                              setSelectedChartDate((prev) => (prev === date ? null : date))
                              setPage(1)
                            }
                          },
                          style: { cursor: 'pointer' },
                        }}
                      />
                    </LineChart>
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
                {(selectedChartFilial ||
                  selectedChartDate ||
                  selectedChartRef ||
                  chartRefSearch) && (
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
                          <TableHead>Ref</TableHead>
                          <TableHead className="text-left">Valor</TableHead>
                          <TableHead>Tipo de Pagamento</TableHead>
                          <TableHead>Data de Pagamento</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-center">Foto</TableHead>
                          {isAdmin && <TableHead className="text-center">Ações</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Object.keys(groupedByRef).length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={isAdmin ? 10 : 9}
                              className="h-24 text-center text-muted-foreground"
                            >
                              Nenhum pagamento encontrado com os filtros atuais.
                            </TableCell>
                          </TableRow>
                        ) : (
                          Object.entries(groupedByRef).flatMap(
                            ([refName, records]: [string, any]) => {
                              const totalLines = filteredStatsData.filter((c) => {
                                const cRef = c.referencia ?? c.expand?.colaborador_id?.referencia
                                const cRefStr =
                                  cRef != null ? `Referência: ${cRef}` : 'Sem Referência'
                                return cRefStr === refName
                              }).length
                              return [
                                <TableRow
                                  key={`header-${refName}`}
                                  className="bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                                >
                                  <TableCell
                                    colSpan={isAdmin ? 10 : 9}
                                    className="font-semibold text-slate-700 dark:text-slate-300"
                                  >
                                    {refName} - {totalLines}{' '}
                                    {totalLines === 1 ? 'pagamento' : 'pagamentos'}
                                  </TableCell>
                                </TableRow>,
                                ...records.map((p: any) => (
                                  <TableRow key={p.id}>
                                    <TableCell className="font-medium pl-8">
                                      {p.nome || p.expand?.colaborador_id?.nome || 'Desconhecido'}
                                    </TableCell>
                                    <TableCell>
                                      {p.registro || p.expand?.colaborador_id?.registro || '-'}
                                    </TableCell>
                                    <TableCell>
                                      {p.filial || p.expand?.colaborador_id?.filial || '-'}
                                    </TableCell>
                                    <TableCell>
                                      {p.referencia || p.expand?.colaborador_id?.referencia || '-'}
                                    </TableCell>
                                    <TableCell className="text-emerald-600 dark:text-emerald-500 font-medium text-left">
                                      {formatBRL(p.valor_a_receber || p.valor)}
                                    </TableCell>
                                    <TableCell>{getTipoPagamento(p.idtipopgto)}</TableCell>
                                    <TableCell>{formatLocalTime(p.data_pagamento)}</TableCell>
                                    <TableCell>
                                      {(() => {
                                        const status = getEvaluatedStatus(p, maxRef)
                                        if (!status) return null

                                        if (status === 'Confirmado')
                                          return (
                                            <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white">
                                              Confirmado
                                            </Badge>
                                          )
                                        if (status === 'Agendado') {
                                          return (
                                            <TooltipProvider>
                                              <Tooltip>
                                                <TooltipTrigger className="cursor-help">
                                                  <Badge className="bg-slate-400 hover:bg-slate-500 text-white flex items-center gap-1 w-max">
                                                    <Lock className="w-3 h-3" />
                                                    Agendado
                                                  </Badge>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                  <p>
                                                    Liberado em:{' '}
                                                    {formatDateDBToBR(p.data_liberacao)}
                                                  </p>
                                                </TooltipContent>
                                              </Tooltip>
                                            </TooltipProvider>
                                          )
                                        }
                                        if (status === 'Bloqueado') {
                                          return (
                                            <Badge className="bg-rose-500 hover:bg-rose-600 text-white flex items-center gap-1 w-max">
                                              <Lock className="w-3 h-3" />
                                              Bloqueado
                                            </Badge>
                                          )
                                        }
                                        if (status === 'Pendente') {
                                          return (
                                            <Badge className="bg-amber-500 hover:bg-amber-600 text-white">
                                              Pendente
                                            </Badge>
                                          )
                                        }
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
                                    {isAdmin && (
                                      <TableCell className="text-center">
                                        {(() => {
                                          const status = getEvaluatedStatus(p, maxRef)

                                          const isOutsideValidity =
                                            p.referencia && maxRef > 0 && p.referencia < maxRef - 3

                                          // If it explicitly was set to Pendente, it shouldn't show the Liberar/Bloquear button
                                          // because it's already bypassing rules. But to be safe and match UI consistency,
                                          // we show the button if it's considered outside validity, though it acts unlocked.
                                          // Actually, if status is 'Pendente' (explicitly or legitimately), we allow toggling.
                                          return (
                                            <div className="flex justify-center gap-1">
                                              {(status === 'Pendente' || status === 'Bloqueado') &&
                                                isOutsideValidity && (
                                                  <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className={cn(
                                                      'hover:bg-amber-100 dark:hover:bg-amber-900/50',
                                                      p.liberado_pagamento
                                                        ? 'text-emerald-500 hover:text-emerald-700'
                                                        : 'text-amber-500 hover:text-amber-700',
                                                    )}
                                                    onClick={() => handleToggleRelease(p)}
                                                    title={
                                                      p.liberado_pagamento
                                                        ? 'Bloquear Pagamento'
                                                        : 'Liberar Pagamento'
                                                    }
                                                  >
                                                    {p.liberado_pagamento ? (
                                                      <Lock className="h-4 w-4" />
                                                    ) : (
                                                      <Unlock className="h-4 w-4" />
                                                    )}
                                                  </Button>
                                                )}
                                              {(status === 'Pendente' ||
                                                status === 'Bloqueado' ||
                                                status === 'Agendado') && (
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  className="text-rose-500 hover:text-rose-700 hover:bg-rose-100 dark:hover:bg-rose-900/50"
                                                  onClick={() => setPaymentToCancel(p)}
                                                  title="Excluir Pagamento"
                                                >
                                                  <Trash2 className="h-4 w-4" />
                                                </Button>
                                              )}
                                            </div>
                                          )
                                        })()}
                                      </TableCell>
                                    )}
                                  </TableRow>
                                )),
                              ]
                            },
                          )
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile View */}
                  <div className="md:hidden space-y-6">
                    {Object.keys(groupedByRef).length === 0 ? (
                      <div className="text-center text-muted-foreground p-8">
                        Nenhum pagamento encontrado.
                      </div>
                    ) : (
                      Object.entries(groupedByRef).map(([refName, records]: [string, any]) => {
                        const totalLines = filteredStatsData.filter((c) => {
                          const cRef = c.referencia ?? c.expand?.colaborador_id?.referencia
                          const cRefStr = cRef != null ? `Referência: ${cRef}` : 'Sem Referência'
                          return cRefStr === refName
                        }).length
                        return (
                          <div key={refName} className="space-y-4">
                            <div className="font-semibold text-slate-700 dark:text-slate-300 px-2 pt-2 border-b pb-2">
                              {refName} - {totalLines}{' '}
                              {totalLines === 1 ? 'pagamento' : 'pagamentos'}
                            </div>
                            {records.map((p: any) => (
                              <Card key={p.id} className="shadow-sm">
                                <CardContent className="p-4 flex flex-col gap-2">
                                  <div className="flex justify-between font-bold">
                                    <span className="truncate">
                                      {p.nome || p.expand?.colaborador_id?.nome || 'Desconhecido'}
                                    </span>
                                    <span className="text-emerald-600 dark:text-emerald-500">
                                      {formatBRL(p.valor_a_receber || p.valor)}
                                    </span>
                                  </div>
                                  <div className="text-sm text-muted-foreground flex justify-between">
                                    <span>
                                      Reg: {p.registro || p.expand?.colaborador_id?.registro || '-'}
                                    </span>
                                    <span>
                                      {p.filial || p.expand?.colaborador_id?.filial || '-'}
                                      {p.referencia ? ` (Ref: ${p.referencia})` : ''}
                                    </span>
                                  </div>
                                  <div className="text-sm text-muted-foreground flex justify-between">
                                    <span>{getTipoPagamento(p.idtipopgto)}</span>
                                  </div>
                                  <div className="text-sm text-muted-foreground flex justify-between">
                                    <span>Data de Pagamento:</span>
                                    <span>{formatLocalTime(p.data_pagamento)}</span>
                                  </div>
                                  <div className="text-sm text-muted-foreground flex justify-between items-center mt-2 border-t pt-2">
                                    <div>
                                      {(() => {
                                        const status = getEvaluatedStatus(p, maxRef)
                                        if (!status) return null

                                        if (status === 'Confirmado')
                                          return (
                                            <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white">
                                              Confirmado
                                            </Badge>
                                          )
                                        if (status === 'Agendado') {
                                          return (
                                            <TooltipProvider>
                                              <Tooltip>
                                                <TooltipTrigger className="cursor-help">
                                                  <Badge className="bg-slate-400 hover:bg-slate-500 text-white flex items-center gap-1">
                                                    <Lock className="w-3 h-3" />
                                                    Agendado
                                                  </Badge>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                  <p>
                                                    Liberado em:{' '}
                                                    {formatDateDBToBR(p.data_liberacao)}
                                                  </p>
                                                </TooltipContent>
                                              </Tooltip>
                                            </TooltipProvider>
                                          )
                                        }
                                        if (status === 'Bloqueado') {
                                          return (
                                            <Badge className="bg-rose-500 hover:bg-rose-600 text-white flex items-center gap-1 w-max">
                                              <Lock className="w-3 h-3" />
                                              Bloqueado
                                            </Badge>
                                          )
                                        }
                                        if (status === 'Pendente') {
                                          return (
                                            <Badge className="bg-amber-500 hover:bg-amber-600 text-white">
                                              Pendente
                                            </Badge>
                                          )
                                        }
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
                                      {isAdmin &&
                                        (() => {
                                          const status = getEvaluatedStatus(p, maxRef)

                                          const isOutsideValidity =
                                            p.referencia && maxRef > 0 && p.referencia < maxRef - 3

                                          return (
                                            <>
                                              {(status === 'Pendente' || status === 'Bloqueado') &&
                                                isOutsideValidity && (
                                                  <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className={cn(
                                                      'px-2 hover:bg-amber-100 dark:hover:bg-amber-900/50',
                                                      p.liberado_pagamento
                                                        ? 'text-emerald-500 hover:text-emerald-700'
                                                        : 'text-amber-500 hover:text-amber-700',
                                                    )}
                                                    onClick={() => handleToggleRelease(p)}
                                                    title={
                                                      p.liberado_pagamento
                                                        ? 'Bloquear Pagamento'
                                                        : 'Liberar Pagamento'
                                                    }
                                                  >
                                                    {p.liberado_pagamento ? (
                                                      <Lock className="h-4 w-4 mr-2" />
                                                    ) : (
                                                      <Unlock className="h-4 w-4 mr-2" />
                                                    )}
                                                    {p.liberado_pagamento ? 'Bloquear' : 'Liberar'}
                                                  </Button>
                                                )}
                                              {(status === 'Pendente' ||
                                                status === 'Bloqueado' ||
                                                status === 'Agendado') && (
                                                <Button
                                                  variant="ghost"
                                                  size="sm"
                                                  className="text-rose-500 hover:text-rose-700 hover:bg-rose-100 dark:hover:bg-rose-900/50 px-2"
                                                  onClick={() => setPaymentToCancel(p)}
                                                  title="Excluir Pagamento"
                                                >
                                                  <Trash2 className="h-4 w-4 mr-2" />
                                                  Excluir
                                                </Button>
                                              )}
                                            </>
                                          )
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
            <DialogTitle>Excluir Pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p>
              Tem certeza que deseja excluir este registro e todos os pagamentos associados? Esta
              ação não pode ser desfeita.
            </p>
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-md space-y-2 text-sm border">
              <div className="flex justify-between">
                <span className="font-semibold text-muted-foreground">Colaborador:</span>
                <span>
                  {paymentToCancel?.nome ||
                    paymentToCancel?.expand?.colaborador_id?.nome ||
                    'Desconhecido'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-muted-foreground">Valor:</span>
                <span className="text-emerald-600 dark:text-emerald-500 font-medium">
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
                <span>{formatLocalTime(paymentToCancel?.data_pagamento)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-muted-foreground">Filial:</span>
                <span>{paymentToCancel?.filial}</span>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPaymentToCancel(null)}>
              Voltar
            </Button>
            <Button variant="destructive" onClick={handleDeletePayment}>
              Confirmar Exclusão
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
