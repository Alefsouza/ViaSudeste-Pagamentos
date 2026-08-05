import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
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
  FileDown,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
import { getColaboradoresAnalytics, fetchPagamentosForColabs } from '@/services/colaboradores'
import { getPagamentosForColaboradoresFilter } from '@/services/pagamentos'
import { useRealtime } from '@/hooks/use-realtime'
import { useAuth } from '@/hooks/use-auth'
import pb from '@/lib/pocketbase/client'
import { Skeleton } from '@/components/ui/skeleton'
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination'
import { useToast } from '@/hooks/use-toast'
import {
  formatBRL,
  getTipoPagamento,
  getTipoPagamentoAbrev,
  checkIsLocked,
  formatDateDBToBR,
  formatDateTimeBR,
  getPaymentDisplayDate,
  normalizeTimestampForSort,
  toBrasiliaDateString,
} from '@/lib/formatters'
import { ExportFolhaModal } from '@/components/ExportFolhaModal'
import { DashboardPaymentModal } from '@/components/DashboardPaymentModal'
import { PaymentTableRow } from '@/components/PaymentTableRow'
import { groupPaymentsByPhoto } from '@/lib/payment-grouping'
import { purgeReference } from '@/services/purge'

export const getEvaluatedStatus = (curr: any, maxRef: number) => {
  if (curr.pagamento_relacionado?.status === 'Cancelado') return 'Cancelado'
  if (curr.pagamento_relacionado?.status === 'Confirmado') return 'Confirmado'
  let status = curr.foto_confirmacao_url ? 'Confirmado' : 'Pendente'

  const liberadoPagamento = curr.liberado_pagamento
  const dataLiberacao = curr.data_liberacao
  const ref = curr.referencia || 0

  if (status === 'Pendente') {
    const isLocked = checkIsLocked(dataLiberacao)
    const isOutsideWindow = ref > 0 && maxRef > 0 && ref < maxRef - 5

    if (isLocked) {
      status = 'Agendado'
    } else if (isOutsideWindow && !liberadoPagamento) {
      status = 'Bloqueado'
    }
  }

  return status
}

export const getActualValue = (curr: any) => {
  if (curr.pagamento_relacionado?.status === 'Confirmado') {
    return curr.pagamento_relacionado.valor_pago || 0
  }
  return curr.valor_a_receber || curr.valor || 0
}

export const normalizeDateForSort = (dateStr: string): string => {
  return normalizeTimestampForSort(dateStr)
}

export const getPaymentSortDate = (curr: any): string | null => {
  const pag = curr.pagamento_relacionado

  const dataPagamento =
    pag?.data_pagamento || curr.data_pagamento || pag?.data_pagamento_v2 || curr.data_pagamento_v2
  const horaPagamento = pag?.hora_pagamento || curr.hora_pagamento

  if (dataPagamento) {
    const alreadyHasTime = dataPagamento.includes(' ') || dataPagamento.includes('T')
    if (!alreadyHasTime && horaPagamento) {
      return `${dataPagamento} ${horaPagamento}`
    }
    return dataPagamento
  }

  const updatedDate = pag?.updated || curr.updated
  if (updatedDate) return updatedDate

  const createdDate = pag?.created || curr.created
  if (createdDate) return createdDate

  return null
}

export default function Dashboard() {
  const { toast } = useToast()
  const { user } = useAuth()
  const isAdmin = user?.role === 'Administrador'
  const isAuthorized =
    user?.email === 'ti@viasudeste.com' || user?.email === 'alcimara.cabral@viasudeste.com'
  const canManagePayments = isAuthorized

  const [paymentToCancel, setPaymentToCancel] = useState<any>(null)
  const [maxRef, setMaxRef] = useState<number>(0)
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
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
  const [error, setError] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  const [statsData, setStatsData] = useState<any[]>([])
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [isPurging, setIsPurging] = useState(false)
  const [purgeDialogOpen, setPurgeDialogOpen] = useState(false)
  const [fetchError, setFetchError] = useState(false)
  const retryCountRef = useRef(0)

  // Chart Interactive Filters
  const [selectedChartFilial, setSelectedChartFilial] = useState<string | null>(null)
  const [selectedChartDate, setSelectedChartDate] = useState<string | null>(null)
  const [selectedChartRef, setSelectedChartRef] = useState<Set<string>>(new Set())
  const [chartRefSearch, setChartRefSearch] = useState('')

  // Concurrency & Debounce Refs
  const isFetchingRef = useRef(false)
  const pendingRefreshRef = useRef(false)
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const debouncedFiltersRef = useRef(debouncedFilters)

  useEffect(() => {
    debouncedFiltersRef.current = debouncedFilters
  }, [debouncedFilters])

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

  const fetchCoreData = async (filtersToUse: any, retries = 3, backoff = 1000): Promise<any> => {
    try {
      const apiFilters = {
        ...filtersToUse,
        startDate: '',
        endDate: '',
        status: 'Todos',
      }

      const [stats, pags, maxRefRec] = await Promise.all([
        getColaboradoresAnalytics(apiFilters),
        getPagamentosForColaboradoresFilter(apiFilters),
        pb
          .collection('colaboradores')
          .getFirstListItem('referencia > 0', { sort: '-referencia', fields: 'referencia' })
          .catch(() => ({ referencia: 0 })),
      ])

      return { stats, pags, maxRef: maxRefRec?.referencia || 0 }
    } catch (e: any) {
      if (e.status === 429 && retries > 0) {
        await new Promise((r) => setTimeout(r, backoff))
        return fetchCoreData(filtersToUse, retries - 1, backoff * 2)
      }
      throw e
    }
  }

  const performFetch = useCallback(
    async (showLoading = true) => {
      if (isFetchingRef.current) {
        pendingRefreshRef.current = true
        return
      }

      isFetchingRef.current = true
      if (showLoading) {
        setStatsLoading(true)
        setFetchError(false)
        retryCountRef.current = 0
      }

      try {
        const result = await fetchCoreData(debouncedFiltersRef.current)
        const mergedStats = result.stats.map((colab: any) => {
          const pag = result.pags.find(
            (p: any) => p.colaborador_id === colab.id && p.status === 'Confirmado',
          )
          if (pag) {
            colab.pagamento_relacionado = pag
          }
          return colab
        })

        setStatsData(mergedStats)
        setMaxRef(result.maxRef)
        setError(false)
        setIsRetrying(false)
        setFetchError(false)
        retryCountRef.current = 0

        isFetchingRef.current = false
        setStatsLoading(false)

        if (pendingRefreshRef.current) {
          pendingRefreshRef.current = false
          performFetch(false)
        }
      } catch (e: any) {
        if (e?.status === 401 || e?.response?.status === 401) {
          isFetchingRef.current = false
          setStatsLoading(false)
          pb.authStore.clear()
          window.location.href = '/'
          return
        }

        retryCountRef.current += 1
        isFetchingRef.current = false

        if (retryCountRef.current < 3) {
          setIsRetrying(true)
          if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current)
          retryTimeoutRef.current = setTimeout(() => {
            performFetch(showLoading)
          }, 2000)
        } else {
          setIsRetrying(false)
          setStatsLoading(false)
          setFetchError(true)
          retryCountRef.current = 0
        }
      }
    },
    [toast],
  )

  const scheduleRefresh = useCallback(() => {
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current)
    }
    debounceTimeoutRef.current = setTimeout(() => {
      performFetch(false)
    }, 1000)
  }, [performFetch])

  useEffect(() => {
    performFetch(true)
  }, [
    debouncedFilters.search,
    debouncedFilters.filial,
    debouncedFilters.tipoPagamento,
    debouncedFilters.referencia,
    performFetch,
  ])

  const handleToggleRelease = useCallback(
    async (payment: any) => {
      if (!isAuthorized) {
        toast({
          title: 'Ação não permitida',
          description: 'Você não tem permissão para liberar pagamentos.',
          variant: 'destructive',
        })
        return
      }
      try {
        const liberadoPagamento = payment.liberado_pagamento
        const newStatus = !liberadoPagamento

        const dataUpdate: any = { liberado_pagamento: newStatus }
        if (newStatus) {
          dataUpdate.data_liberacao = new Date().toISOString()
        }

        const records = payment._isGrouped ? payment._records : [payment]
        for (const record of records) {
          await pb.collection('colaboradores').update(record.id, dataUpdate)
        }

        toast({
          title: newStatus
            ? `${records.length} pagamento(s) liberado(s) com sucesso.`
            : `${records.length} pagamento(s) bloqueado(s) com sucesso.`,
        })
        scheduleRefresh(false)
      } catch (err: any) {
        toast({
          title: 'Erro ao alterar o status do pagamento. Tente novamente.',
          variant: 'destructive',
        })
      }
    },
    [isAuthorized, toast, scheduleRefresh],
  )

  const handleDeletePayment = async () => {
    if (!paymentToCancel) return
    if (!isAuthorized) {
      toast({
        title: 'Ação não permitida',
        description: 'Você não tem permissão para excluir registros.',
        variant: 'destructive',
      })
      return
    }
    try {
      const records = paymentToCancel._isGrouped ? paymentToCancel._records : [paymentToCancel]
      for (const record of records) {
        await pb.collection('colaboradores').delete(record.id)

        try {
          const relatedPags = await pb
            .collection('pagamentos')
            .getFullList({ filter: `colaborador_id="${record.id}"` })
          for (const p of relatedPags) {
            await pb.collection('pagamentos').delete(p.id)
          }
        } catch {
          /* intentionally ignored */
        }
      }

      toast({ title: `${records.length} registro(s) excluído(s) com sucesso!` })
      setPaymentToCancel(null)
      scheduleRefresh(false)
    } catch (err: any) {
      toast({
        title: 'Erro ao excluir o registro. Por favor, tente novamente.',
        variant: 'destructive',
      })
    }
  }

  const handlePaymentConfirmed = useCallback((colaboradorIds: string[]) => {
    const idSet = new Set(colaboradorIds)
    setStatsData((prev) =>
      prev.map((c) => {
        if (idSet.has(c.id)) {
          return {
            ...c,
            pagamento_relacionado: {
              ...(c.pagamento_relacionado || {}),
              status: 'Confirmado',
              valor_pago: c.valor_a_receber || c.valor || 0,
            },
          }
        }
        return c
      }),
    )
  }, [])

  const handlePurgeReference = useCallback(async () => {
    const refsToDelete = Array.from(selectedChartRef)
    if (refsToDelete.length === 0) return

    setIsPurging(true)
    try {
      for (const ref of refsToDelete) {
        await purgeReference(Number(ref))
      }
      toast({
        title: `Referência ${refsToDelete.join(', ')} excluída com sucesso.`,
      })
      setSelectedChartRef(new Set())
      setChartRefSearch('')
      setPurgeDialogOpen(false)
      performFetch(true)
    } catch (err) {
      toast({
        title: 'Erro ao excluir referência. Tente novamente.',
        variant: 'destructive',
      })
    } finally {
      setIsPurging(false)
    }
  }, [selectedChartRef, toast, performFetch])

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
          const actualRef = c.referencia
          if (actualRef != null) next.add(actualRef)
        })
        return next
      })
    }
  }, [statsData])

  useRealtime('colaboradores', () => scheduleRefresh(), !isImporting)
  useRealtime('pagamentos', () => scheduleRefresh(), !isImporting)

  useEffect(() => {
    const handleImportStart = () => setIsImporting(true)
    const handleImportEnd = () => {
      setIsImporting(false)
      performFetch(true)
    }

    window.addEventListener('import-start', handleImportStart)
    window.addEventListener('import-end', handleImportEnd)
    return () => {
      window.removeEventListener('import-start', handleImportStart)
      window.removeEventListener('import-end', handleImportEnd)
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current)
    }
  }, [performFetch])

  const availableTipos = Array.from(knownTipos).sort()
  const availableRefs = Array.from(knownRefs).sort((a, b) => b - a)

  // baseStatsData applies the global date and status filters
  const baseStatsData = useMemo(() => {
    return statsData.filter((curr) => {
      const evaluatedStatus = getEvaluatedStatus(curr, maxRef)
      if (evaluatedStatus === 'Cancelado' && debouncedFilters.status !== 'Cancelado') return false
      if (debouncedFilters.status !== 'Todos' && evaluatedStatus !== debouncedFilters.status)
        return false

      if (debouncedFilters.startDate || debouncedFilters.endDate) {
        if (evaluatedStatus === 'Confirmado') {
          const hasPhoto =
            curr.pagamento_relacionado?.foto_confirmacao_url || curr.foto_confirmacao_url
          let updatedStr = ''
          if (hasPhoto) {
            updatedStr = curr.pagamento_relacionado?.updated || curr.updated
          }
          if (updatedStr) {
            const rawDate = toBrasiliaDateString(updatedStr)
            if (debouncedFilters.startDate && (!rawDate || rawDate < debouncedFilters.startDate))
              return false
            if (debouncedFilters.endDate && (!rawDate || rawDate > debouncedFilters.endDate))
              return false
          } else {
            return false
          }
        } // If not Confirmado (e.g. Pendente), we maintain visibility by letting it pass the date filter.
      }
      return true
    })
  }, [
    statsData,
    debouncedFilters.status,
    debouncedFilters.startDate,
    debouncedFilters.endDate,
    maxRef,
  ])

  // filteredStatsData applies the interactive chart filters on top
  const filteredStatsData = useMemo(() => {
    return baseStatsData.filter((curr) => {
      const filialStr =
        curr.filial === 2 ? 'Cursino' : curr.filial === 4 ? 'Sapopemba' : curr.filial || 'Outra'
      if (selectedChartFilial && filialStr !== selectedChartFilial) return false

      if (selectedChartRef.size > 0) {
        const actualRef = curr.referencia
        const cRef = actualRef != null ? String(actualRef) : 'N/A'
        if (!selectedChartRef.has(cRef)) return false
      }

      if (chartRefSearch) {
        const actualRef = curr.referencia
        const cRef = actualRef != null ? String(actualRef) : 'N/A'
        if (!cRef.toLowerCase().includes(chartRefSearch.toLowerCase())) return false
      }

      if (selectedChartDate) {
        const hasPhoto =
          curr.pagamento_relacionado?.foto_confirmacao_url || curr.foto_confirmacao_url
        let dateKey: string | null = null
        if (hasPhoto) {
          const updatedDate = curr.pagamento_relacionado?.updated || curr.updated
          dateKey = toBrasiliaDateString(updatedDate)
        }

        if (!dateKey || dateKey !== selectedChartDate) return false
      }

      return true
    })
  }, [baseStatsData, selectedChartFilial, selectedChartDate, selectedChartRef, chartRefSearch])

  // Cross-filtered datasets: each chart excludes its own filter so it shows
  // the full distribution within the current context (Power BI behavior)
  const pieStatsData = useMemo(() => {
    return baseStatsData.filter((curr) => {
      if (selectedChartRef.size > 0) {
        const actualRef = curr.referencia
        const cRef = actualRef != null ? String(actualRef) : 'N/A'
        if (!selectedChartRef.has(cRef)) return false
      }
      if (chartRefSearch) {
        const actualRef = curr.referencia
        const cRef = actualRef != null ? String(actualRef) : 'N/A'
        if (!cRef.toLowerCase().includes(chartRefSearch.toLowerCase())) return false
      }
      if (selectedChartDate) {
        const hasPhoto =
          curr.pagamento_relacionado?.foto_confirmacao_url || curr.foto_confirmacao_url
        let dateKey: string | null = null
        if (hasPhoto) {
          const updatedDate = curr.pagamento_relacionado?.updated || curr.updated
          dateKey = toBrasiliaDateString(updatedDate)
        }
        if (!dateKey || dateKey !== selectedChartDate) return false
      }
      return true
    })
  }, [baseStatsData, selectedChartRef, selectedChartDate, chartRefSearch])

  const refStatsData = useMemo(() => {
    return baseStatsData.filter((curr) => {
      const filialStr =
        curr.filial === 2 ? 'Cursino' : curr.filial === 4 ? 'Sapopemba' : curr.filial || 'Outra'
      if (selectedChartFilial && filialStr !== selectedChartFilial) return false
      if (selectedChartDate) {
        const hasPhoto =
          curr.pagamento_relacionado?.foto_confirmacao_url || curr.foto_confirmacao_url
        let dateKey: string | null = null
        if (hasPhoto) {
          const updatedDate = curr.pagamento_relacionado?.updated || curr.updated
          dateKey = toBrasiliaDateString(updatedDate)
        }
        if (!dateKey || dateKey !== selectedChartDate) return false
      }
      return true
    })
  }, [baseStatsData, selectedChartFilial, selectedChartDate])

  const dailyStatsData = useMemo(() => {
    return baseStatsData.filter((curr) => {
      const filialStr =
        curr.filial === 2 ? 'Cursino' : curr.filial === 4 ? 'Sapopemba' : curr.filial || 'Outra'
      if (selectedChartFilial && filialStr !== selectedChartFilial) return false
      if (selectedChartRef.size > 0) {
        const actualRef = curr.referencia
        const cRef = actualRef != null ? String(actualRef) : 'N/A'
        if (!selectedChartRef.has(cRef)) return false
      }
      if (chartRefSearch) {
        const actualRef = curr.referencia
        const cRef = actualRef != null ? String(actualRef) : 'N/A'
        if (!cRef.toLowerCase().includes(chartRefSearch.toLowerCase())) return false
      }
      return true
    })
  }, [baseStatsData, selectedChartFilial, selectedChartRef, chartRefSearch])

  const tableData = useMemo(() => {
    const grouped = groupPaymentsByPhoto(filteredStatsData, maxRef)
    const sorted = [...grouped].sort((a, b) => {
      const dateA = getPaymentSortDate(a)
      const dateB = getPaymentSortDate(b)

      // Empty/null dates appear at the top for immediate attention
      if (!dateA && !dateB) {
        const regA = String(a.registro || '')
        const regB = String(b.registro || '')
        if (regA !== regB) return regA.localeCompare(regB, undefined, { numeric: true })
        return (b.created || '').localeCompare(a.created || '')
      }
      if (!dateA) return -1
      if (!dateB) return 1

      // Primary sort: data_pagamento descending (most recent first)
      const normA = normalizeDateForSort(dateA)
      const normB = normalizeDateForSort(dateB)
      if (normA !== normB) return normB.localeCompare(normA)

      // Secondary sort: updated timestamp descending (time-aware tiebreaker)
      const updA = normalizeDateForSort(
        a.pagamento_relacionado?.updated || a.updated || a.created || '',
      )
      const updB = normalizeDateForSort(
        b.pagamento_relacionado?.updated || b.updated || b.created || '',
      )
      if (updA !== updB) return updB.localeCompare(updA)

      // Tertiary sort: registro ascending
      const regA = String(a.registro || '')
      const regB = String(b.registro || '')
      if (regA !== regB) return regA.localeCompare(regB, undefined, { numeric: true })

      // Quaternary sort: created descending
      return (b.created || '').localeCompare(a.created || '')
    })

    const startIndex = (page - 1) * 20
    const items = sorted.slice(startIndex, startIndex + 20)
    return {
      items,
      totalPages: Math.ceil(sorted.length / 20) || 1,
    }
  }, [filteredStatsData, page, maxRef])

  const allConfirmed = useMemo(() => {
    if (tableData.items.length === 0) return false
    return tableData.items.every((item: any) => getEvaluatedStatus(item, maxRef) === 'Confirmado')
  }, [tableData.items, maxRef])

  const showActionsColumn = canManagePayments && !allConfirmed

  const pagamentosTotals = useMemo(() => {
    return filteredStatsData.reduce(
      (acc, curr) => {
        const val = getActualValue(curr)
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
          acc.confirmadoCount += 1
          if (acronym === 'HE') acc.pagoHE += val
          if (acronym === 'VR') acc.pagoVR += val
          if (acronym === 'FT') acc.pagoFT += val
        } else if (status === 'Pendente') {
          acc.pendente += val
          acc.pendenteCount += 1
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
        confirmadoCount: 0,
        pendenteCount: 0,
      },
    )
  }, [filteredStatsData])

  // Calculations
  const uniqueColabs = new Set(
    filteredStatsData
      .filter((c) => {
        let status = getEvaluatedStatus(c, maxRef)
        return status !== 'Agendado' && status !== 'Cancelado' && status !== 'Bloqueado'
      })
      .map((c) => c.registro)
      .filter(Boolean),
  ).size

  const confirmedPayments = filteredStatsData.filter((c) => {
    let status = getEvaluatedStatus(c, maxRef)
    return status === 'Confirmado'
  })

  const confirmedValues = confirmedPayments.map((c) => getActualValue(c))
  const maxPago = confirmedValues.length ? Math.max(...confirmedValues) : 0
  const minPago = confirmedValues.length ? Math.min(...confirmedValues) : 0
  const avgPago = confirmedValues.length ? pagamentosTotals.pago / confirmedValues.length : 0

  // Chart Data Preparation using baseStatsData to show global filtered context without interactive charts applied yet
  const pieDataMap = pieStatsData.reduce(
    (acc, curr) => {
      const filialStr =
        curr.filial === 2 ? 'Cursino' : curr.filial === 4 ? 'Sapopemba' : curr.filial || 'Outra'
      acc[filialStr] = (acc[filialStr] || 0) + getActualValue(curr)
      return acc
    },
    {} as Record<string, number>,
  )

  const pieData = Object.entries(pieDataMap).map(([name, value]) => ({ name, value }))

  const dailyDataMap = dailyStatsData.reduce(
    (acc, curr) => {
      const status = getEvaluatedStatus(curr, maxRef)
      if (status !== 'Confirmado') return acc

      let dateKey: string | null = null
      const hasPhoto = curr.pagamento_relacionado?.foto_confirmacao_url || curr.foto_confirmacao_url
      if (hasPhoto) {
        const updatedDate = curr.pagamento_relacionado?.updated || curr.updated
        dateKey = toBrasiliaDateString(updatedDate)
      }

      if (!dateKey) return acc

      acc[dateKey] = (acc[dateKey] || 0) + getActualValue(curr)
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

  const refDataMap = refStatsData.reduce(
    (acc, curr) => {
      const actualRef = curr.referencia
      const ref = actualRef != null ? String(actualRef) : 'N/A'

      if (chartRefSearch && !ref.toLowerCase().includes(chartRefSearch.toLowerCase())) {
        return acc
      }
      if (!acc[ref]) {
        acc[ref] = { total: 0, periodo_inicio: null, periodo_fim: null }
      }
      acc[ref].total += getActualValue(curr)

      if (!acc[ref].periodo_inicio) {
        acc[ref].periodo_inicio = curr.periodo_inicio || null
      }
      if (!acc[ref].periodo_fim) {
        acc[ref].periodo_fim = curr.periodo_fim || null
      }

      return acc
    },
    {} as Record<
      string,
      { total: number; periodo_inicio: string | null; periodo_fim: string | null }
    >,
  )

  const refData = Object.entries(refDataMap)
    .sort(([a], [b]) => {
      const numA = Number(a)
      const numB = Number(b)
      const isNumA = !isNaN(numA) && a.trim() !== '' && a !== 'N/A'
      const isNumB = !isNaN(numB) && b.trim() !== '' && b !== 'N/A'
      if (isNumA && isNumB) return numA - numB
      if (isNumA && !isNumB) return -1
      if (!isNumA && isNumB) return 1
      return a.localeCompare(b)
    })
    .map(([ref, data]) => ({
      referenciaName: ref,
      total: data.total,
      periodo_inicio: data.periodo_inicio,
      periodo_fim: data.periodo_fim,
    }))

  const isEmpty = baseStatsData.length === 0 && !statsLoading

  return (
    <div className="container mx-auto py-8 px-4 space-y-8 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Painel do Gestor
            </h1>
            {(isRetrying || isImporting) && (
              <Badge
                variant="outline"
                className="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 animate-pulse flex items-center gap-1.5"
              >
                <svg
                  className="animate-spin h-3.5 w-3.5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                {isImporting
                  ? 'Importação em andamento...'
                  : 'Finalizando sincronização de dados...'}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            Analise a distribuição de pagamentos e monitore as filiais.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManagePayments && (
            <DashboardPaymentModal maxRef={maxRef} onPaymentConfirmed={handlePaymentConfirmed} />
          )}
          {(selectedChartFilial ||
            selectedChartDate ||
            selectedChartRef.size > 0 ||
            chartRefSearch) && (
            <div className="flex items-center gap-2 flex-wrap animate-fade-in">
              {selectedChartFilial && (
                <Badge
                  variant="secondary"
                  className="cursor-pointer gap-1"
                  onClick={() => {
                    setSelectedChartFilial(null)
                    setPage(1)
                  }}
                >
                  Filial: {selectedChartFilial}
                  <FilterX className="h-3 w-3" />
                </Badge>
              )}
              {selectedChartRef.size > 0 && (
                <Badge
                  variant="secondary"
                  className="cursor-pointer gap-1"
                  onClick={() => {
                    setSelectedChartRef(new Set())
                    setPage(1)
                  }}
                >
                  Ref: {Array.from(selectedChartRef).join(', ')}
                  <FilterX className="h-3 w-3" />
                </Badge>
              )}
              {selectedChartDate && (
                <Badge
                  variant="secondary"
                  className="cursor-pointer gap-1"
                  onClick={() => {
                    setSelectedChartDate(null)
                    setPage(1)
                  }}
                >
                  Data: {selectedChartDate.split('-').reverse().join('/')}
                  <FilterX className="h-3 w-3" />
                </Badge>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedChartFilial(null)
                  setSelectedChartDate(null)
                  setSelectedChartRef(new Set())
                  setChartRefSearch('')
                  setPage(1)
                }}
                className="text-muted-foreground"
              >
                <FilterX className="h-4 w-4 mr-2" />
                Limpar Filtros
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      {!fetchError && (
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
                  <SelectItem value="Bloqueado">Bloqueado</SelectItem>
                  <SelectItem value="Agendado">Agendado</SelectItem>
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
      )}

      {/* Summary Cards */}
      {!fetchError && (
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
                <div className="text-xl font-bold transition-all duration-300">{uniqueColabs}</div>
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
                <div className="text-xl font-bold transition-all duration-300">
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
                <div className="text-xl font-bold transition-all duration-300">
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
                <div className="text-xl font-bold transition-all duration-300">
                  {formatBRL(avgPago)}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {fetchError ? (
        <Card className="flex flex-col items-center justify-center p-12">
          <AlertCircle className="h-12 w-12 text-rose-500 mb-4" />
          <p className="text-lg font-medium text-foreground mb-2">Erro ao carregar dados</p>
          <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
            Ocorreu um erro ao sincronizar os pagamentos. Verifique sua conexão e tente novamente.
          </p>
          <Button
            onClick={() => {
              setFetchError(false)
              retryCountRef.current = 0
              performFetch(true)
            }}
          >
            Tentar novamente
          </Button>
        </Card>
      ) : isEmpty ? (
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
                <div className="flex items-center gap-2">
                  {isAuthorized && selectedChartRef.size > 0 && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 text-rose-500 hover:text-rose-700 hover:bg-rose-100 dark:hover:bg-rose-900/50"
                      onClick={() => setPurgeDialogOpen(true)}
                      disabled={isPurging}
                      title="Excluir referência selecionada"
                    >
                      {isPurging ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                  <div className="relative w-32 md:w-40">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar ref..."
                      className="pl-8 h-9 text-sm"
                      value={chartRefSearch}
                      onChange={(e) => setChartRefSearch(e.target.value)}
                    />
                  </div>
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
                        onClick={(data: any, index: number, event: any) => {
                          const refVal =
                            data?.referenciaName ||
                            data?.payload?.referenciaName ||
                            (refData[index] && refData[index].referenciaName)
                          if (!refVal) return
                          const isCtrl = event && (event.ctrlKey || event.metaKey)
                          setSelectedChartRef((prev) => {
                            const next = new Set(prev)
                            if (isCtrl) {
                              if (next.has(refVal)) {
                                next.delete(refVal)
                              } else {
                                next.add(refVal)
                              }
                            } else {
                              if (next.size === 1 && next.has(refVal)) {
                                next.clear()
                              } else {
                                next.clear()
                                next.add(refVal)
                              }
                            }
                            return next
                          })
                          setPage(1)
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        {refData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill="var(--color-total)"
                            style={{
                              opacity:
                                selectedChartRef.size === 0 ||
                                selectedChartRef.has(entry.referenciaName)
                                  ? 1
                                  : 0.3,
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
                    {dailyData.length === 0 ? (
                      <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm">
                        Nenhum pagamento confirmado no período
                      </div>
                    ) : (
                      <LineChart
                        data={dailyData}
                        margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                        onClick={(e: any) => {
                          if (e && e.activePayload && e.activePayload.length > 0) {
                            const rawDate = e.activePayload[0].payload.date
                            if (rawDate) {
                              setSelectedChartDate((prev: any) =>
                                prev === rawDate ? null : rawDate,
                              )
                              setPage(1)
                            }
                          }
                        }}
                        style={{ cursor: 'pointer' }}
                      >
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
                        <ChartTooltip
                          cursor={{
                            stroke: 'hsl(var(--muted))',
                            strokeWidth: 2,
                            strokeDasharray: '3 3',
                            fill: 'transparent',
                          }}
                          content={<ChartTooltipContent />}
                        />
                        <Line
                          type="monotone"
                          dataKey="total"
                          stroke="var(--color-total)"
                          strokeWidth={3}
                          dot={({ cx, cy, payload }: any) => {
                            const isActive =
                              !selectedChartDate || payload?.date === selectedChartDate
                            return (
                              <circle
                                key={`dot-${payload?.date}`}
                                cx={cx}
                                cy={cy}
                                r={isActive ? 5 : 3}
                                fill="var(--color-total)"
                                opacity={isActive ? 1 : 0.3}
                                style={{ transition: 'all 0.2s' }}
                              />
                            )
                          }}
                          activeDot={{ r: 8, strokeWidth: 0, fill: 'var(--color-total)' }}
                        />
                      </LineChart>
                    )}
                  </ChartContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center flex-wrap gap-2">
                Transações de Pagamentos
                {(selectedChartFilial ||
                  selectedChartDate ||
                  selectedChartRef.size > 0 ||
                  chartRefSearch) && (
                  <span className="text-sm font-normal text-muted-foreground">
                    (Filtro de gráfico ativo
                    {selectedChartDate
                      ? `: ${selectedChartDate.includes('/') ? selectedChartDate : selectedChartDate.split('-').reverse().join('/')}`
                      : ''}
                    )
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
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
                          <TableHead className="whitespace-nowrap">
                            Ref <ArrowDown className="inline-block w-3 h-3 ml-1" />
                          </TableHead>
                          <TableHead className="text-left">Valor Pago</TableHead>
                          <TableHead>Tipo de Pagamento</TableHead>
                          <TableHead className="whitespace-nowrap">
                            Data de Pagamento <ArrowDown className="inline-block w-3 h-3 ml-1" />
                          </TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-center">Foto</TableHead>
                          {showActionsColumn && (
                            <TableHead className="text-center">Ações</TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(tableData.items || []).length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={showActionsColumn ? 10 : 9}
                              className="h-24 text-center text-muted-foreground"
                            >
                              {selectedChartDate
                                ? 'Nenhuma transação encontrada para esta data.'
                                : 'Nenhum pagamento encontrado com os filtros atuais.'}
                            </TableCell>
                          </TableRow>
                        ) : (
                          (tableData.items || []).map((p: any) => (
                            <PaymentTableRow
                              key={p.id}
                              record={p}
                              maxRef={maxRef}
                              canManagePayments={showActionsColumn}
                              onPhotoClick={setSelectedPhotoUrl}
                              onToggleRelease={handleToggleRelease}
                              onDeleteClick={setPaymentToCancel}
                            />
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile View */}
                  <div className="md:hidden space-y-6">
                    {(tableData.items || []).length === 0 ? (
                      <div className="text-center text-muted-foreground p-8">
                        {selectedChartDate
                          ? 'Nenhuma transação encontrada para esta data.'
                          : 'Nenhum pagamento encontrado com os filtros atuais.'}
                      </div>
                    ) : (
                      (tableData.items || []).map((p: any) => (
                        <Card key={p.id} className="shadow-sm">
                          <CardContent className="p-4 flex flex-col gap-2">
                            <div className="flex justify-between font-bold">
                              <span className="truncate">
                                {p._isGrouped ? p.nomes.join(', ') : p.nome || 'Desconhecido'}
                              </span>
                              <span className="text-emerald-600 dark:text-emerald-500">
                                {formatBRL(getActualValue(p))}
                              </span>
                            </div>
                            <div className="text-sm text-muted-foreground flex justify-between">
                              <span>
                                Reg: {p._isGrouped ? p.registros.join(', ') : p.registro || '-'}
                              </span>
                              <span>
                                {p._isGrouped
                                  ? p.filiais.join(', ')
                                  : p.filial === 2
                                    ? 'Cursino'
                                    : p.filial === 4
                                      ? 'Sapopemba'
                                      : p.filial || '-'}
                                {p._isGrouped
                                  ? p.referencias.length > 0
                                    ? ` (Ref: ${p.referencias.join(', ')})`
                                    : ''
                                  : p.referencia
                                    ? ` (Ref: ${p.referencia})`
                                    : ''}
                              </span>
                            </div>
                            <div className="text-sm text-muted-foreground flex justify-between">
                              <span>
                                {p._isGrouped
                                  ? p.tipos_pagamento.join(', ')
                                  : getTipoPagamentoAbrev(p.idtipopgto)}
                              </span>
                            </div>
                            <div className="text-sm text-muted-foreground flex justify-between">
                              <span>Data de Pagamento:</span>
                              <span>
                                {(() => {
                                  const displayDate = getPaymentDisplayDate(p)
                                  return displayDate ? formatDateTimeBR(displayDate) : '-'
                                })()}
                              </span>
                            </div>{' '}
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
                                            <p>Liberado em: {formatDateDBToBR(p.data_liberacao)}</p>
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
                                    onClick={() => setSelectedPhotoUrl(p.foto_confirmacao_url)}
                                  >
                                    <ImageIcon className="w-4 h-4 mr-2" />
                                    Visualizar
                                  </Button>
                                )}
                                {showActionsColumn &&
                                  getEvaluatedStatus(p, maxRef) !== 'Confirmado' &&
                                  (() => {
                                    const status = getEvaluatedStatus(p, maxRef)

                                    const actualRef = p.referencia
                                    const isOutsideValidity =
                                      actualRef && maxRef > 0 && actualRef < maxRef - 5

                                    const liberadoPagamento = p.liberado_pagamento

                                    return (
                                      <>
                                        {(status === 'Pendente' || status === 'Bloqueado') &&
                                          isOutsideValidity && (
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className={cn(
                                                'px-2 hover:bg-amber-100 dark:hover:bg-amber-900/50',
                                                liberadoPagamento
                                                  ? 'text-emerald-500 hover:text-emerald-700'
                                                  : 'text-amber-500 hover:text-amber-700',
                                              )}
                                              onClick={() => handleToggleRelease(p)}
                                              title={
                                                liberadoPagamento
                                                  ? 'Bloquear Pagamento'
                                                  : 'Liberar Pagamento'
                                              }
                                            >
                                              {liberadoPagamento ? (
                                                <Lock className="h-4 w-4 mr-2" />
                                              ) : (
                                                <Unlock className="h-4 w-4 mr-2" />
                                              )}
                                              {liberadoPagamento ? 'Bloquear' : 'Liberar'}
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
                      ))
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

      <ExportFolhaModal open={exportModalOpen} onOpenChange={setExportModalOpen} />

      <Dialog open={!!paymentToCancel} onOpenChange={(open) => !open && setPaymentToCancel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p>
              Tem certeza que deseja excluir{' '}
              {paymentToCancel?._isGrouped
                ? `estes ${paymentToCancel._records.length} pagamentos`
                : 'este pagamento'}
              ? Esta ação não pode ser desfeita.
            </p>
            <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-md space-y-2 text-sm border">
              <div className="flex justify-between">
                <span className="font-semibold text-muted-foreground">Colaborador:</span>
                <span>{paymentToCancel?.nome || 'Desconhecido'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-muted-foreground">Valor:</span>
                <span className="text-emerald-600 dark:text-emerald-500 font-medium">
                  {paymentToCancel ? formatBRL(getActualValue(paymentToCancel)) : ''}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-muted-foreground">Data de Pagamento:</span>
                <span>
                  {(() => {
                    const displayDate = getPaymentDisplayDate(paymentToCancel)
                    return displayDate ? formatDateTimeBR(displayDate) : '-'
                  })()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-muted-foreground">Filial:</span>
                <span>
                  {paymentToCancel?.filial === 2
                    ? 'Cursino'
                    : paymentToCancel?.filial === 4
                      ? 'Sapopemba'
                      : paymentToCancel?.filial}
                </span>
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

      <AlertDialog open={purgeDialogOpen} onOpenChange={setPurgeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza que deseja excluir?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá remover permanentemente todos os colaboradores e pagamentos associados à
              referência {Array.from(selectedChartRef).join(', ')}. Esta operação não pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPurging}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handlePurgeReference()
              }}
              disabled={isPurging}
              className="bg-rose-500 hover:bg-rose-600 text-white"
            >
              {isPurging ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Confirmar Exclusão'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
