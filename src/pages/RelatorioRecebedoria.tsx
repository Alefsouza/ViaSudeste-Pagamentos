import React, { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useToast } from '@/hooks/use-toast'
import { getColaboradoresPaginated, getColaboradoresAnalytics } from '@/services/colaboradores'
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
import {
  formatDataString,
  formatHoraString,
  formatHoras,
  getTipoPagamento,
  formatBRL,
} from '@/lib/formatters'

export default function RelatorioRecebedoria() {
  const { user } = useAuth()
  const { toast } = useToast()

  const [data, setData] = useState<any[]>([])
  const [statsData, setStatsData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)

  // Filters State
  const [datePreset, setDatePreset] = useState('Últimos 30 dias')
  const [startDate, setStartDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return d.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0])

  const [customStartDate, setCustomStartDate] = useState(startDate)
  const [customEndDate, setCustomEndDate] = useState(endDate)

  const [statusFilter, setStatusFilter] = useState('Todos')
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')

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
    setLoading(true)
    setError(false)
    try {
      const filters = {
        startDate: datePreset === 'Data customizada' ? customStartDate : startDate,
        endDate: datePreset === 'Data customizada' ? customEndDate : endDate,
        search: debouncedSearchTerm,
        status: statusFilter,
      }
      const [result, stats] = await Promise.all([
        getColaboradoresPaginated(page, 20, filters),
        getColaboradoresAnalytics(filters),
      ])
      setData(result.items)
      setStatsData(stats)
      setTotalPages(result.totalPages || 1)
      setTotalItems(result.totalItems || 0)
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
    customStartDate,
    customEndDate,
    datePreset,
    debouncedSearchTerm,
    statusFilter,
  ])

  useRealtime('pagamentos', () => {
    loadData()
  })
  useRealtime('colaboradores', () => {
    loadData()
  })

  const handlePresetChange = (preset: string) => {
    setDatePreset(preset)
    if (preset === 'Data customizada') return

    const today = new Date()
    const start = new Date()

    if (preset === 'Ontem') {
      start.setDate(today.getDate() - 1)
      today.setDate(today.getDate() - 1)
    } else if (preset === 'Últimos 7 dias') {
      start.setDate(today.getDate() - 7)
    } else if (preset === 'Últimos 30 dias') {
      start.setDate(today.getDate() - 30)
    } else if (preset === 'Mês atual') {
      start.setDate(1)
    }

    setStartDate(start.toISOString().split('T')[0])
    setEndDate(today.toISOString().split('T')[0])
    setPage(1)
  }

  const clearFilters = () => {
    setStatusFilter('Todos')
    setSearchTerm('')
    handlePresetChange('Últimos 30 dias')
    setPage(1)
  }

  const handleExport = () => {
    window.print()
  }

  // Group items by name
  const groupedByName = data.reduce((acc: any, item: any) => {
    const n = item.nome || 'Desconhecido'
    if (!acc[n]) acc[n] = []
    acc[n].push(item)
    return acc
  }, {})

  return (
    <div className="container mx-auto py-8 px-4 space-y-6 print:py-0 print:px-0">
      <style>
        {`
          @media print {
            @page { margin: 10mm; }
            body, html {
              background-color: white !important;
              color: black !important;
            }
            aside, header, nav, [data-sidebar] {
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
            }
            tr {
              page-break-inside: avoid;
              page-break-after: auto;
            }
          }
        `}
      </style>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:mb-6">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="space-y-2 lg:col-span-1">
            <Label>Período</Label>
            <Select value={datePreset} onValueChange={handlePresetChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Hoje">Hoje</SelectItem>
                <SelectItem value="Ontem">Ontem</SelectItem>
                <SelectItem value="Últimos 7 dias">Últimos 7 dias</SelectItem>
                <SelectItem value="Últimos 30 dias">Últimos 30 dias</SelectItem>
                <SelectItem value="Mês atual">Mês atual</SelectItem>
                <SelectItem value="Data customizada">Data customizada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {datePreset === 'Data customizada' && (
            <>
              <div className="space-y-2">
                <Label>Data Inicial</Label>
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Final</Label>
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                />
              </div>
            </>
          )}

          <div className="space-y-2 lg:col-span-1">
            <Label>Busca</Label>
            <Input
              placeholder="Buscar por Registro ou Nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-white dark:bg-slate-950"
            />
          </div>

          <div className="space-y-2 lg:col-span-1">
            <Label>Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                <SelectItem value="Confirmado">Confirmado</SelectItem>
                <SelectItem value="Pendente">Pendente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end lg:col-span-1">
            <Button
              variant="ghost"
              onClick={clearFilters}
              className="text-slate-500 w-full sm:w-auto h-10 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <FilterX className="h-4 w-4 mr-2" />
              Limpar Filtros
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {error ? (
        <div className="text-center py-12 bg-rose-50 dark:bg-rose-950/20 rounded-xl border border-rose-100 dark:border-rose-900/50">
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
        <>
          {/* Desktop Table */}
          <div className="hidden md:block print:block rounded-xl border bg-white dark:bg-slate-900 overflow-hidden shadow-sm print:border-none print:shadow-none">
            <Table className="print:text-sm">
              <TableHeader className="bg-slate-50 dark:bg-slate-800/50 print:bg-transparent print:border-b-2 print:border-slate-800">
                <TableRow className="print:border-none">
                  <TableHead className="print:text-black print:font-bold">Registro</TableHead>
                  <TableHead className="print:text-black print:font-bold">Nome</TableHead>
                  <TableHead className="print:text-black print:font-bold">Data</TableHead>
                  <TableHead className="text-right print:text-black print:font-bold">
                    Valor
                  </TableHead>
                  <TableHead className="text-left w-[150px] print:text-black print:font-bold">
                    Tipo de Pagamento
                  </TableHead>
                  <TableHead className="text-center print:text-black print:font-bold">
                    Status
                  </TableHead>
                  <TableHead className="text-center print:hidden">Foto</TableHead>
                  <TableHead className="text-right print:hidden">Ações</TableHead>
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
                    <TableCell colSpan={8} className="h-48 text-center">
                      <SearchX className="mx-auto h-10 w-10 text-slate-300 mb-3" />
                      <p className="text-slate-500 font-medium">Nenhum pagamento encontrado.</p>
                      <Button variant="outline" size="sm" onClick={clearFilters} className="mt-4">
                        Limpar Filtros
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  Object.entries(groupedByName).map(([nome, records]: [string, any]) => {
                    const totalLines = statsData.filter(
                      (c) => (c.nome || 'Desconhecido') === nome,
                    ).length
                    return (
                      <React.Fragment key={nome}>
                        <TableRow className="bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 print:bg-slate-100">
                          <TableCell
                            colSpan={8}
                            className="font-semibold text-slate-700 dark:text-slate-300 print:text-black"
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
                              className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 print:break-inside-avoid"
                            >
                              <TableCell className="font-medium pl-8 print:text-black">
                                {item.registro}
                              </TableCell>
                              <TableCell className="print:text-black">{item.nome}</TableCell>
                              <TableCell className="print:text-black">
                                {item.data_pagamento || '-'}
                              </TableCell>
                              <TableCell className="text-right font-medium print:text-black">
                                {formatBRL(item.valor_a_receber || item.valor)}
                              </TableCell>
                              <TableCell className="text-left print:text-black">
                                {getTipoPagamento(item.idtipopgto)}
                              </TableCell>
                              <TableCell className="text-center">{statusBadge}</TableCell>
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
                const totalLines = statsData.filter(
                  (c) => (c.nome || 'Desconhecido') === nome,
                ).length
                return (
                  <div key={nome} className="space-y-4">
                    <div className="font-semibold text-slate-700 dark:text-slate-300 px-2 pt-2 border-b pb-2">
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
                                <div className="font-semibold text-slate-900 dark:text-slate-100">
                                  {item.nome}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                  Reg: {item.registro}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-slate-900 dark:text-slate-100">
                                  {formatBRL(item.valor_a_receber || item.valor)}
                                </div>
                                <div className="mt-1">{statusBadge}</div>
                              </div>
                            </div>
                            <div className="flex flex-col gap-1 text-xs text-slate-500">
                              <span className="font-medium text-slate-700 dark:text-slate-300">
                                {getTipoPagamento(item.idtipopgto)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center pt-3 border-t">
                              <div className="text-xs text-slate-500">
                                {item.data_pagamento || '-'}
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
        </>
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
                  <p className="font-medium">{detailsModal.registro}</p>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 text-xs uppercase block mb-1">
                    Nome
                  </span>
                  <p className="font-medium">{detailsModal.nome}</p>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 text-xs uppercase block mb-1">
                    Data e Hora
                  </span>
                  <p className="font-medium">{detailsModal.data_pagamento || '-'}</p>
                </div>
                <div>
                  <span className="font-semibold text-slate-500 text-xs uppercase block mb-1">
                    Valor
                  </span>
                  <p className="font-medium text-emerald-600 dark:text-emerald-400">
                    {formatBRL(detailsModal.valor_a_receber || detailsModal.valor)}
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
                  <p className="font-medium">{getTipoPagamento(detailsModal.idtipopgto)}</p>
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
                    Filial
                  </span>
                  <p className="font-medium">{detailsModal.filial}</p>
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
