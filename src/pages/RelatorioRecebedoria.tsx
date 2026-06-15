import React, { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import {
  Download,
  Image as ImageIcon,
  FileText,
  FilterX,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  SearchX,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatHoraString, formatHoras, getTipoPagamento, formatBRL } from '@/lib/formatters'
import pb from '@/lib/pocketbase/client'

export default function RelatorioRecebedoria() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [data, setData] = useState<any[]>([])
  const [summaryData, setSummaryData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('detalhado')
  const [error, setError] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)

  // Filters State
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [timeError, setTimeError] = useState('')

  const [statusFilter, setStatusFilter] = useState('Todos')
  const [usuarioFilter, setUsuarioFilter] = useState('Todos')
  const [garagemFilter, setGaragemFilter] = useState('Todos')
  const [tipoPagamentoFilter, setTipoPagamentoFilter] = useState('Todos')

  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')

  // Filter Options State
  const [allUsers, setAllUsers] = useState<any[]>([])
  const [usuariosRecebedoria, setUsuariosRecebedoria] = useState<any[]>([])
  const [filiaisOptions, setFiliaisOptions] = useState<{ label: string; value: string }[]>([])
  const [tiposPagamento, setTiposPagamento] = useState<string[]>([])

  useEffect(() => {
    async function fetchFilterOptions() {
      try {
        const usersRes = await pb.collection('users').getFullList({
          filter: 'tipo_usuario = "recebedoria"',
        })
        setUsuariosRecebedoria(usersRes)

        const allUsersRes = await pb.collection('users').getFullList()
        setAllUsers(allUsersRes)

        // Get proper Filial Names
        const colabRes = await pb.collection('colaboradores').getFullList({
          fields: 'filial,filial_id',
        })
        const mapNomes = new Map<number, string>()
        colabRes.forEach((c: any) => {
          if (c.filial && c.filial_id != null) {
            mapNomes.set(c.filial_id, c.filial)
          }
        })

        const pagamentosRes = await pb
          .collection('pagamentos')
          .getFullList({ fields: 'tipo_pagamento,filial' })

        const uniqueTipos = Array.from(
          new Set(pagamentosRes.map((p: any) => p.tipo_pagamento).filter(Boolean)),
        )
        setTiposPagamento(uniqueTipos as string[])

        const uniqueFiliais = Array.from(
          new Set(
            pagamentosRes
              .map((p: any) => p.filial)
              .filter((f) => f !== null && f !== undefined && f !== ''),
          ),
        )
        const options = uniqueFiliais.map((f) => ({
          label: mapNomes.get(Number(f)) || String(f),
          value: String(f),
        }))
        setFiliaisOptions(options.sort((a, b) => a.label.localeCompare(b.label)))
      } catch (err) {
        console.error('Error fetching filter options:', err)
      }
    }
    fetchFilterOptions()
  }, [])

  // Modals
  const [photoModal, setPhotoModal] = useState<string | null>(null)
  const [detailsModal, setDetailsModal] = useState<any | null>(null)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
      setPage(1)
    }, 500)
    return () => clearTimeout(handler)
  }, [searchTerm])

  const loadData = async () => {
    if (!user) return

    if (startTime && endTime && endTime < startTime) {
      setTimeError('Horário Final não pode ser menor que o Horário Inicial.')
      setLoading(false)
      return
    } else {
      setTimeError('')
    }

    setLoading(true)
    setError(false)
    try {
      const conditions: string[] = []

      if (startDate && endDate) {
        conditions.push(
          `data_pagamento >= "${startDate} 00:00:00" && data_pagamento <= "${endDate} 23:59:59"`,
        )
      }
      if (startTime) {
        conditions.push(`hora_pagamento >= "${startTime}"`)
      }
      if (endTime) {
        conditions.push(`hora_pagamento <= "${endTime}"`)
      }
      if (debouncedSearchTerm) {
        conditions.push(
          `(nome ~ "${debouncedSearchTerm}" || registro ~ "${debouncedSearchTerm}" || colaborador_id.nome ~ "${debouncedSearchTerm}" || colaborador_id.registro ~ "${debouncedSearchTerm}")`,
        )
      }

      if (statusFilter && statusFilter !== 'Todos') {
        if (statusFilter === 'Confirmado') {
          conditions.push(`(status = "Confirmado" || foto_confirmacao_url != "")`)
        } else if (statusFilter === 'Pendente') {
          conditions.push(`(status = "Pendente" || status = "")`)
        } else if (statusFilter === 'Cancelado') {
          conditions.push(`status = "Cancelado"`)
        } else {
          conditions.push(`status = "${statusFilter}"`)
        }
      }

      if (usuarioFilter && usuarioFilter !== 'Todos') {
        conditions.push(`user_id = "${usuarioFilter}"`)
      }

      if (garagemFilter && garagemFilter !== 'Todos') {
        conditions.push(`filial = ${garagemFilter}`)
      }

      if (tipoPagamentoFilter && tipoPagamentoFilter !== 'Todos') {
        conditions.push(`tipo_pagamento = "${tipoPagamentoFilter}"`)
      }

      const filterString = conditions.length > 0 ? conditions.join(' && ') : ''

      const results = await Promise.allSettled([
        pb.collection('pagamentos').getList(page, 20, {
          filter: filterString,
          sort: '-created',
          expand: 'colaborador_id,user_id',
        }),
        pb.collection('pagamentos').getFullList({
          filter: filterString,
          sort: '-created',
          expand: 'colaborador_id,user_id',
        }),
      ])

      const paginatedRes = results[0]
      const fullRes = results[1]

      if (paginatedRes.status === 'fulfilled') {
        setData(paginatedRes.value.items)
        setTotalPages(paginatedRes.value.totalPages || 1)
        setTotalItems(paginatedRes.value.totalItems || 0)
      } else {
        throw new Error('Falha ao carregar pagamentos paginados')
      }

      if (fullRes.status === 'fulfilled') {
        setSummaryData(fullRes.value)
      } else {
        setSummaryData([])
      }
    } catch (err: any) {
      console.error(err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [
    page,
    startDate,
    endDate,
    startTime,
    endTime,
    debouncedSearchTerm,
    statusFilter,
    usuarioFilter,
    garagemFilter,
    tipoPagamentoFilter,
    allUsers.length,
    filiaisOptions.length,
  ])

  useRealtime('pagamentos', () => {
    loadData()
  })

  const clearFilters = () => {
    setStatusFilter('Todos')
    setUsuarioFilter('Todos')
    setGaragemFilter('Todos')
    setTipoPagamentoFilter('Todos')
    setSearchTerm('')
    setStartTime('')
    setEndTime('')
    setTimeError('')
    const start = new Date()
    start.setDate(start.getDate() - 30)
    setStartDate(start.toISOString().split('T')[0])
    setEndDate(new Date().toISOString().split('T')[0])
    setPage(1)
  }

  const handleExport = () => {
    window.print()
  }

  const formatDateStringSafe = (dateStr: string) => {
    if (!dateStr || dateStr === '-') return '-'
    if (dateStr.includes('/')) return dateStr
    if (dateStr.includes('-')) {
      const parts = dateStr.split(' ')[0].split('-')
      if (parts.length >= 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
    }
    return dateStr
  }

  // Group items by name
  const groupedByName = data.reduce((acc: any, item: any) => {
    const n = item.expand?.colaborador_id?.nome || item.nome || 'Desconhecido'
    if (!acc[n]) acc[n] = []
    acc[n].push(item)
    return acc
  }, {})

  // Summary Data grouping for simple table
  const summaryArray = React.useMemo(() => {
    const summary = summaryData.reduce((acc: any, item: any) => {
      const isConfirmado = item.status === 'Confirmado' && !!item.foto_confirmacao_url
      if (!isConfirmado) return acc

      const nome = item.expand?.colaborador_id?.nome || item.nome || 'Desconhecido'
      const tipo = item.tipo_pagamento || getTipoPagamento(item.idtipopgto) || 'Outros'
      const key = `${nome}_${tipo}`
      if (!acc[key]) {
        acc[key] = { nome, tipo, total: 0 }
      }
      acc[key].total +=
        item.expand?.colaborador_id?.valor_a_receber ||
        item.valor_pago ||
        item.valor_a_receber ||
        item.valor ||
        0
      return acc
    }, {})
    return Object.values(summary).sort((a: any, b: any) => a.nome.localeCompare(b.nome)) as {
      nome: string
      tipo: string
      total: number
    }[]
  }, [summaryData])

  // Consolidated Summary grouped by Payment Type and Date
  const consolidatedSummary = React.useMemo(() => {
    const targetCategories = [
      { name: 'Hora Extra', keywords: ['hora extra', 'hora extras', 'horas extras'] },
      { name: 'Férias', keywords: ['férias', 'ferias', 'férias trabalhada', 'ferias trabalhada'] },
      { name: 'VR', keywords: ['vr', 'vale refeição', 'vale refeicao', 'vale-refeição'] },
    ]

    const typeGroups: Record<
      string,
      { tipo: string; rows: { data: string; total: number }[]; subtotal: number }
    > = {}

    summaryData.forEach((item) => {
      const isConfirmado = item.status === 'Confirmado' && !!item.foto_confirmacao_url
      if (!isConfirmado) return

      const tipoRaw = (item.tipo_pagamento || getTipoPagamento(item.idtipopgto) || '').toLowerCase()

      const matchedCategory = targetCategories.find((cat) =>
        cat.keywords.some((keyword) => tipoRaw.includes(keyword)),
      )

      const tipoName = matchedCategory
        ? matchedCategory.name
        : item.tipo_pagamento || getTipoPagamento(item.idtipopgto) || 'Outros'
      const dataPagamento = item.data_pagamento ? item.data_pagamento.split(' ')[0] : '-'

      const val =
        item.expand?.colaborador_id?.valor_a_receber ||
        item.valor_pago ||
        item.valor_a_receber ||
        item.valor ||
        0

      if (!typeGroups[tipoName]) {
        typeGroups[tipoName] = { tipo: tipoName, rows: [], subtotal: 0 }
      }

      let dataRow = typeGroups[tipoName].rows.find((r) => r.data === dataPagamento)
      if (!dataRow) {
        dataRow = { data: dataPagamento, total: 0 }
        typeGroups[tipoName].rows.push(dataRow)
      }
      dataRow.total += val
      typeGroups[tipoName].subtotal += val
    })

    const groups = Object.values(typeGroups).filter((g) => g.subtotal > 0)

    groups.sort((a, b) => a.tipo.localeCompare(b.tipo))

    let totalGeral = 0
    groups.forEach((g) => {
      g.rows.sort((a, b) => a.data.localeCompare(b.data))
      totalGeral += g.subtotal
    })

    return { groups, totalGeral }
  }, [summaryData])

  return (
    <div className="container mx-auto py-8 px-4 space-y-6 print:py-0 print:px-0">
      <style>
        {`
          @media print {
            @page { margin: 15mm; }
            body, html {
              background-color: white !important;
              color: black !important;
            }
            aside, header, nav, [data-sidebar], .print\\:hidden {
              display: none !important;
            }
            main {
              padding: 0 !important;
              margin: 0 !important;
              overflow: visible !important;
            }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            table {
              page-break-inside: auto;
              width: 100% !important;
            }
            tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
            .double-underline {
              text-decoration: underline double !important;
              text-underline-offset: 4px !important;
            }
          }
        `}
      </style>

      {/* Print Header */}
      <div className="hidden print:block mb-8">
        <div className="flex justify-between items-end border-b-2 border-slate-800 pb-4 mb-4">
          <div>
            <h1 className="text-3xl font-bold uppercase tracking-wider text-black">
              Relatório de Pagamentos Consolidados
            </h1>
          </div>
          <div className="text-right text-base text-black">
            <p>
              <span className="font-bold">Data de Emissão:</span>{' '}
              {new Date().toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 text-base text-black">
          <div>
            <p>
              <span className="font-bold">Período:</span> {formatDateStringSafe(startDate)} a{' '}
              {formatDateStringSafe(endDate)}
            </p>
            <p>
              <span className="font-bold">Filial:</span>{' '}
              {garagemFilter === 'Todos'
                ? 'Todas'
                : filiaisOptions.find((f) => f.value === garagemFilter)?.label || garagemFilter}
            </p>
          </div>
          <div className="text-right">
            <p>
              <span className="font-bold">Usuário:</span> {user?.name || user?.email || 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white print:text-black">
            Relatórios de Pagamentos
          </h1>
          <p className="text-muted-foreground mt-1 print:text-slate-700">
            Meus pagamentos processados.
          </p>
        </div>
        <Button onClick={handleExport} className="w-full sm:w-auto print:hidden">
          <Download className="mr-2 h-4 w-4" />
          Exportar
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border space-y-4 print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          <div className="space-y-2">
            <Label>Data Inicial</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-white dark:bg-slate-950"
            />
          </div>
          <div className="space-y-2">
            <Label>Data Final</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-white dark:bg-slate-950"
            />
          </div>

          <div className="space-y-2">
            <Label>Horário Inicial</Label>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="bg-white dark:bg-slate-950"
            />
          </div>
          <div className="space-y-2 relative">
            <Label>Horário Final</Label>
            <Input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className={cn(
                'bg-white dark:bg-slate-950',
                timeError && 'border-red-500 focus-visible:ring-red-500',
              )}
            />
            {timeError && (
              <p className="text-[10px] text-red-500 absolute -bottom-4 left-0">{timeError}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Busca</Label>
            <Input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white dark:bg-slate-950"
            />
          </div>

          <div className="space-y-2">
            <Label>Garagem</Label>
            <Select value={garagemFilter} onValueChange={setGaragemFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todas</SelectItem>
                {filiaisOptions.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Usuário</Label>
            <Select value={usuarioFilter} onValueChange={setUsuarioFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                {usuariosRecebedoria.map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name || u.email || 'Usuário'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tipo Pagamento</Label>
            <Select value={tipoPagamentoFilter} onValueChange={setTipoPagamentoFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                {tiposPagamento.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <div className="hidden sm:block h-5"></div>
            <Button
              variant="ghost"
              onClick={clearFilters}
              className="text-slate-500 w-full h-10 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <FilterX className="h-4 w-4 mr-2" />
              Limpar
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {error ? (
        <div className="text-center py-12 bg-rose-50 dark:bg-rose-950/20 rounded-xl border border-rose-100 dark:border-rose-900/50 print:hidden">
          <AlertCircle className="mx-auto h-12 w-12 mb-4 text-rose-500 opacity-80" />
          <h3 className="text-lg font-semibold text-rose-700 dark:text-rose-400">
            Erro ao carregar pagamentos
          </h3>
          <Button
            variant="outline"
            className="mt-4 border-rose-200 text-rose-600 hover:bg-rose-100"
            onClick={loadData}
          >
            Tentar novamente
          </Button>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4 w-full sm:w-auto grid grid-cols-2 print:hidden">
            <TabsTrigger value="detalhado">Relatório Detalhado</TabsTrigger>
            <TabsTrigger value="resumido">Relatório Resumido</TabsTrigger>
          </TabsList>

          <TabsContent value="detalhado" className="mt-0 space-y-6">
            {/* Desktop Table */}
            <div className="hidden md:block print:block rounded-xl border bg-white dark:bg-slate-900 overflow-hidden shadow-sm print:border-none print:shadow-none">
              <Table className="text-base print:text-base">
                <TableHeader className="bg-slate-50 dark:bg-slate-800/50 print:bg-transparent print:border-b-2 print:border-slate-800">
                  <TableRow className="print:border-none text-base">
                    <TableHead className="print:text-black print:font-bold text-base">
                      Registro
                    </TableHead>
                    <TableHead className="print:text-black print:font-bold text-base">
                      Nome
                    </TableHead>
                    <TableHead className="print:text-black print:font-bold text-base">
                      Data
                    </TableHead>
                    <TableHead className="print:text-black print:font-bold text-base">
                      Horário
                    </TableHead>
                    <TableHead className="text-right print:text-black print:font-bold text-base">
                      Valor
                    </TableHead>
                    <TableHead className="text-left w-[150px] print:text-black print:font-bold text-base">
                      Tipo de Pagamento
                    </TableHead>
                    <TableHead className="text-center print:text-black print:font-bold text-base">
                      Status
                    </TableHead>
                    <TableHead className="text-center print:hidden text-base">Foto</TableHead>
                    <TableHead className="text-right print:hidden text-base">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    [...Array(10)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-40" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-32" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-16" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24 ml-auto" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-6 w-24 mx-auto rounded-full" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-8 w-24 mx-auto" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-8 w-24 ml-auto" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : data.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-48 text-center">
                        <SearchX className="mx-auto h-10 w-10 text-slate-300 mb-3" />
                        <p className="text-slate-500 font-medium">Nenhum pagamento encontrado.</p>
                        <Button variant="outline" size="sm" onClick={clearFilters} className="mt-4">
                          Limpar Filtros
                        </Button>
                      </TableCell>
                    </TableRow>
                  ) : (
                    Object.entries(groupedByName).map(([nome, records]: [string, any]) => {
                      const totalLines = summaryData.filter(
                        (c) =>
                          (c.expand?.colaborador_id?.nome || c.nome || 'Desconhecido') === nome,
                      ).length
                      return (
                        <React.Fragment key={nome}>
                          <TableRow className="bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 print:bg-slate-100">
                            <TableCell
                              colSpan={9}
                              className="font-semibold text-lg text-slate-700 dark:text-slate-300 print:text-black"
                            >
                              {nome} - {totalLines}{' '}
                              {totalLines === 1 ? 'linha de pagamento' : 'linhas de pagamento'}
                            </TableCell>
                          </TableRow>
                          {records.map((item: any) => {
                            const isConfirmado = !!item.foto_confirmacao_url
                            const statusBadge = isConfirmado ? (
                              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 shadow-none border-none">
                                Confirmado
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 shadow-none border-none">
                                Pendente
                              </Badge>
                            )

                            return (
                              <TableRow
                                key={item.id}
                                className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 print:break-inside-avoid text-base"
                              >
                                <TableCell className="font-medium pl-8 print:text-black text-base">
                                  {item.expand?.colaborador_id?.registro || item.registro || 'N/A'}
                                </TableCell>
                                <TableCell className="print:text-black text-base">
                                  {item.expand?.colaborador_id?.nome || item.nome || 'Desconhecido'}
                                </TableCell>
                                <TableCell className="print:text-black text-base">
                                  {formatDateStringSafe(item.data_pagamento) || '-'}
                                </TableCell>
                                <TableCell className="print:text-black text-base">
                                  {item.hora_pagamento || '-'}
                                </TableCell>
                                <TableCell className="text-right font-medium print:text-black text-base">
                                  {formatBRL(
                                    item.expand?.colaborador_id?.valor_a_receber ||
                                      item.valor_pago ||
                                      item.valor_a_receber ||
                                      item.valor,
                                  )}
                                </TableCell>
                                <TableCell className="text-left print:text-black text-base">
                                  {getTipoPagamento(item.idtipopgto) || item.tipo_pagamento}
                                </TableCell>
                                <TableCell className="text-center text-base">
                                  {statusBadge}
                                </TableCell>
                                <TableCell className="text-center print:hidden">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={!isConfirmado}
                                    onClick={() => setPhotoModal(item.foto_confirmacao_url)}
                                    className="text-slate-600 print:hidden"
                                  >
                                    <ImageIcon className="h-4 w-4 mr-2" /> Ver Foto
                                  </Button>
                                </TableCell>
                                <TableCell className="text-right print:hidden">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDetailsModal(item)}
                                    className="print:hidden"
                                  >
                                    <FileText className="h-4 w-4 mr-2" /> Detalhes
                                  </Button>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </React.Fragment>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden print:hidden space-y-6">
              {loading ? (
                [...Array(4)].map((_, i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)
              ) : data.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-xl border">
                  <SearchX className="mx-auto h-10 w-10 text-slate-300 mb-3" />
                  <p className="text-slate-500 font-medium">Nenhum pagamento encontrado.</p>
                  <Button variant="outline" size="sm" onClick={clearFilters} className="mt-4">
                    Limpar Filtros
                  </Button>
                </div>
              ) : (
                Object.entries(groupedByName).map(([nome, records]: [string, any]) => {
                  const totalLines = summaryData.filter(
                    (c) => (c.expand?.colaborador_id?.nome || c.nome || 'Desconhecido') === nome,
                  ).length
                  return (
                    <div key={nome} className="space-y-4">
                      <div className="font-semibold text-lg text-slate-700 dark:text-slate-300 px-2 pt-2 border-b pb-2">
                        {nome} - {totalLines}{' '}
                        {totalLines === 1 ? 'linha de pagamento' : 'linhas de pagamento'}
                      </div>
                      {records.map((item: any) => {
                        const isConfirmado = !!item.foto_confirmacao_url
                        const statusBadge = isConfirmado ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 shadow-none border-none">
                            Confirmado
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 shadow-none border-none">
                            Pendente
                          </Badge>
                        )

                        return (
                          <Card key={item.id} className="shadow-sm">
                            <CardContent className="p-4 space-y-4">
                              <div className="flex justify-between items-start">
                                <div>
                                  <div className="font-semibold text-lg text-slate-900 dark:text-slate-100">
                                    {item.expand?.colaborador_id?.nome ||
                                      item.nome ||
                                      'Desconhecido'}
                                  </div>
                                  <div className="text-sm text-slate-500 mt-1">
                                    Reg:{' '}
                                    {item.expand?.colaborador_id?.registro ||
                                      item.registro ||
                                      'N/A'}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-bold text-lg text-slate-900 dark:text-slate-100">
                                    {formatBRL(
                                      item.expand?.colaborador_id?.valor_a_receber ||
                                        item.valor_pago ||
                                        item.valor_a_receber ||
                                        item.valor,
                                    )}
                                  </div>
                                  <div className="mt-1">{statusBadge}</div>
                                </div>
                              </div>
                              <div className="flex flex-col gap-1 text-sm text-slate-500">
                                <span className="font-medium text-slate-700 dark:text-slate-300">
                                  {getTipoPagamento(item.idtipopgto) || item.tipo_pagamento}
                                </span>
                              </div>
                              <div className="flex justify-between items-center pt-3 border-t">
                                <div className="text-sm text-slate-500">
                                  {formatDateStringSafe(item.data_pagamento) || '-'}{' '}
                                  {item.hora_pagamento || ''}
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    disabled={!isConfirmado}
                                    onClick={() => setPhotoModal(item.foto_confirmacao_url)}
                                  >
                                    <ImageIcon className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    className="h-8"
                                    onClick={() => setDetailsModal(item)}
                                  >
                                    Detalhes
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  )
                })
              )}
            </div>

            {/* Pagination Info */}
            {!loading && totalItems > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 print:hidden">
                <p className="text-sm text-muted-foreground">
                  Mostrando {data.length} de {totalItems} pagamentos (Página {page} de {totalPages})
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
          </TabsContent>

          <TabsContent value="resumido" className="mt-0 space-y-8">
            <div className="print:hidden">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                Total por Colaborador
              </h3>
              <div className="rounded-xl border bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
                <Table className="text-base">
                  <TableHeader className="bg-slate-50 dark:bg-slate-800/50 text-base">
                    <TableRow>
                      <TableHead className="h-10 py-2 text-base">Colaborador</TableHead>
                      <TableHead className="h-10 py-2 text-base">Tipo de Pagamento</TableHead>
                      <TableHead className="h-10 py-2 text-right text-base">
                        Total Acumulado
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      [...Array(5)].map((_, i) => (
                        <TableRow key={i}>
                          <TableCell className="py-2">
                            <Skeleton className="h-4 w-40" />
                          </TableCell>
                          <TableCell className="py-2">
                            <Skeleton className="h-4 w-24" />
                          </TableCell>
                          <TableCell className="py-2">
                            <Skeleton className="h-4 w-24 ml-auto" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : summaryArray.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="h-32 text-center py-8">
                          <SearchX className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                          <p className="text-sm text-slate-500 font-medium">
                            Nenhum registro encontrado para os filtros selecionados.
                          </p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      summaryArray.map((item, idx) => (
                        <TableRow
                          key={idx}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 text-base"
                        >
                          <TableCell className="py-3 font-medium text-base">{item.nome}</TableCell>
                          <TableCell className="py-3 text-base text-slate-600 dark:text-slate-400">
                            {item.tipo}
                          </TableCell>
                          <TableCell className="py-3 text-base text-right font-semibold text-emerald-600 dark:text-emerald-400">
                            {formatBRL(item.total)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4 print:hidden">
                Resumo Consolidado
              </h3>
              <div className="rounded-xl border bg-white dark:bg-slate-900 overflow-hidden shadow-sm print:border-none print:shadow-none">
                <Table className="text-base print:text-base">
                  <TableHeader className="bg-slate-50 dark:bg-slate-800/50 print:bg-transparent text-base">
                    <TableRow className="print:border-b print:border-slate-300">
                      <TableHead className="h-10 py-3 print:text-black print:font-bold print:uppercase text-base">
                        Tipo de Pagamento
                      </TableHead>
                      <TableHead className="h-10 py-3 print:text-black print:font-bold print:uppercase text-base">
                        Data
                      </TableHead>
                      <TableHead className="h-10 py-3 text-right print:text-black print:font-bold print:uppercase text-base">
                        Valor
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      [...Array(3)].map((_, i) => (
                        <TableRow key={i}>
                          <TableCell className="py-3">
                            <Skeleton className="h-4 w-32" />
                          </TableCell>
                          <TableCell className="py-3">
                            <Skeleton className="h-4 w-24" />
                          </TableCell>
                          <TableCell className="py-3">
                            <Skeleton className="h-4 w-24 ml-auto" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : consolidatedSummary.groups.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="h-24 text-center py-8">
                          <p className="text-sm text-slate-500 font-medium">
                            Nenhum registro encontrado.
                          </p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      consolidatedSummary.groups.map((group, gIdx) => (
                        <React.Fragment key={gIdx}>
                          {group.rows.map((row, rIdx) => (
                            <TableRow
                              key={`${gIdx}-${rIdx}`}
                              className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 print:border-b print:border-slate-200 text-base"
                            >
                              <TableCell className="py-3 font-medium text-base print:text-black">
                                {group.tipo}
                              </TableCell>
                              <TableCell className="py-3 font-medium text-base print:text-black">
                                {formatDateStringSafe(row.data)}
                              </TableCell>
                              <TableCell className="py-3 text-base text-right font-medium print:text-black">
                                {formatBRL(row.total)}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-slate-100/80 dark:bg-slate-800/80 print:bg-slate-100 border-t-2 border-slate-200 dark:border-slate-700 print:border-slate-400 text-base">
                            <TableCell
                              colSpan={2}
                              className="py-3 font-bold text-base text-slate-800 dark:text-slate-200 print:text-black uppercase"
                            >
                              Total {group.tipo}
                            </TableCell>
                            <TableCell className="py-3 text-base text-right font-bold text-slate-900 dark:text-white print:text-black">
                              {formatBRL(group.subtotal)}
                            </TableCell>
                          </TableRow>
                        </React.Fragment>
                      ))
                    )}
                  </TableBody>
                  {!loading && consolidatedSummary.groups.length > 0 && (
                    <tfoot className="bg-slate-50 dark:bg-slate-800/50 print:bg-transparent border-t-2 border-slate-300 print:border-slate-800 text-base">
                      <tr>
                        <td
                          colSpan={2}
                          className="p-3 font-bold text-lg text-slate-900 dark:text-slate-100 print:text-black uppercase"
                        >
                          Valor Total Geral
                        </td>
                        <td className="p-3 text-lg text-right font-bold text-indigo-700 dark:text-indigo-400 print:text-black double-underline">
                          {formatBRL(consolidatedSummary.totalGeral)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </Table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {/* Details Modal */}
      <Dialog open={!!detailsModal} onOpenChange={(open) => !open && setDetailsModal(null)}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-950">
          <DialogHeader>
            <DialogTitle>Detalhes do Pagamento</DialogTitle>
          </DialogHeader>
          {detailsModal && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 dark:bg-slate-900 p-4 rounded-lg">
                <div>
                  <span className="font-semibold text-slate-500 text-xs uppercase block mb-1">
                    Registro
                  </span>
                  <p className="font-medium">
                    {detailsModal.expand?.colaborador_id?.registro ||
                      detailsModal.registro ||
                      'N/A'}
                  </p>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 text-xs uppercase block mb-1">
                    Nome
                  </span>
                  <p className="font-medium">
                    {detailsModal.expand?.colaborador_id?.nome ||
                      detailsModal.nome ||
                      'Desconhecido'}
                  </p>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 text-xs uppercase block mb-1">
                    Data e Hora
                  </span>
                  <p className="font-medium">
                    {formatDateStringSafe(detailsModal.data_pagamento) || '-'}{' '}
                    {detailsModal.hora_pagamento || ''}
                  </p>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 text-xs uppercase block mb-1">
                    Valor
                  </span>
                  <p className="font-medium text-emerald-600 dark:text-emerald-400">
                    {formatBRL(
                      detailsModal.expand?.colaborador_id?.valor_a_receber ||
                        detailsModal.valor_pago ||
                        detailsModal.valor_a_receber ||
                        detailsModal.valor,
                    )}
                  </p>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 text-xs uppercase block mb-1">
                    Total de Horas
                  </span>
                  <p className="font-medium">{formatHoras(detailsModal.horas)}</p>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 text-xs uppercase block mb-1">
                    Horário de Início
                  </span>
                  <p className="font-medium">{formatHoraString(detailsModal.inicio)}</p>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 text-xs uppercase block mb-1">
                    Horário de Término
                  </span>
                  <p className="font-medium">{formatHoraString(detailsModal.termino)}</p>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 text-xs uppercase block mb-1">
                    Tipo de Pagamento
                  </span>
                  <p className="font-medium">
                    {getTipoPagamento(detailsModal.idtipopgto) || detailsModal.tipo_pagamento}
                  </p>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 text-xs uppercase block mb-1">
                    Status
                  </span>
                  <div>
                    {detailsModal.foto_confirmacao_url ? (
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 shadow-none border-none">
                        Confirmado
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 shadow-none border-none">
                        Pendente
                      </Badge>
                    )}
                  </div>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 text-xs uppercase block mb-1">
                    Filial ID
                  </span>
                  <p className="font-medium">
                    {detailsModal.expand?.colaborador_id?.filial || detailsModal.filial || 'N/A'}
                  </p>
                </div>
              </div>
              {detailsModal.foto_confirmacao_url && (
                <div className="mt-4">
                  <span className="font-semibold text-slate-500 text-xs uppercase block mb-2">
                    Foto de Comprovação
                  </span>
                  <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border inline-block">
                    <img
                      src={detailsModal.foto_confirmacao_url}
                      alt="Comprovante"
                      className="w-full h-32 object-cover rounded-md cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setPhotoModal(detailsModal.foto_confirmacao_url)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsModal(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photo Modal */}
      <Dialog open={!!photoModal} onOpenChange={(open) => !open && setPhotoModal(null)}>
        <DialogContent className="sm:max-w-2xl bg-white dark:bg-slate-950">
          <DialogHeader>
            <DialogTitle>Foto de Comprovação</DialogTitle>
          </DialogHeader>
          {photoModal && (
            <div className="flex flex-col gap-4">
              <div className="bg-slate-100 dark:bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center min-h-[300px]">
                <img
                  src={photoModal}
                  alt="Comprovante Full"
                  className="w-full h-auto max-h-[60vh] object-contain"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPhotoModal(null)}>
                  Fechar
                </Button>
                <Button
                  onClick={() => {
                    const a = document.createElement('a')
                    a.href = photoModal
                    a.download = 'comprovante.jpg'
                    a.click()
                  }}
                >
                  <Download className="h-4 w-4 mr-2" /> Baixar Imagem
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
