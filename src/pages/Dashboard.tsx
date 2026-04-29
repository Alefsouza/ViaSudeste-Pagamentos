import { useState, useEffect } from 'react'
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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from 'recharts'
import { Users, TrendingUp, DollarSign, Building, Camera, Upload } from 'lucide-react'
import { getColaboradores } from '@/services/colaboradores'
import { Button } from '@/components/ui/button'
import { UploadFotosModal } from '@/components/UploadFotosModal'
import { ImportPlanilhaModal } from '@/components/ImportPlanilhaModal'
import { getPagamentos } from '@/services/pagamentos'
import { useRealtime } from '@/hooks/use-realtime'

export default function Dashboard() {
  const [colaboradores, setColaboradores] = useState<any[]>([])
  const [pagamentos, setPagamentos] = useState<any[]>([])
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)

  const loadData = async () => {
    try {
      const [colabs, pags] = await Promise.all([getColaboradores(), getPagamentos()])
      setColaboradores(colabs)
      setPagamentos(pags)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadData()
  }, [])
  useRealtime('colaboradores', loadData)
  useRealtime('pagamentos', loadData)

  const totalReceber = colaboradores.reduce((acc, c) => acc + c.valor_a_receber, 0)
  const totalPago = pagamentos.reduce((acc, p) => acc + p.valor_pago, 0)
  const totalColabs = colaboradores.length

  const filialData = [
    {
      name: 'Cursino',
      valor: colaboradores
        .filter((c) => c.filial === 'Cursino')
        .reduce((a, c) => a + c.valor_a_receber, 0),
    },
    {
      name: 'Sapopemba',
      valor: colaboradores
        .filter((c) => c.filial === 'Sapopemba')
        .reduce((a, c) => a + c.valor_a_receber, 0),
    },
  ]

  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Painel do Gestor
          </h1>
          <p className="text-muted-foreground mt-1">
            Visão geral financeira e de colaboradores em tempo real.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => setImportModalOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importar Planilha
          </Button>
          <Button onClick={() => setUploadModalOpen(true)}>
            <Camera className="mr-2 h-4 w-4" />
            Upload de Fotos
          </Button>
        </div>
      </div>

      <UploadFotosModal open={uploadModalOpen} onOpenChange={setUploadModalOpen} />
      <ImportPlanilhaModal open={importModalOpen} onOpenChange={setImportModalOpen} />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="animate-fade-in-up" style={{ animationDelay: '0ms' }}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total a Receber</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBRL(totalReceber)}</div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Pago</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBRL(totalPago)}</div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Colaboradores</CardTitle>
            <Users className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalColabs}</div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Filiais Ativas</CardTitle>
            <Building className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Valores a Receber por Filial</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{ valor: { label: 'Valor', color: 'hsl(var(--primary))' } }}
              className="h-[300px] w-full"
            >
              <BarChart data={filialData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `R$ ${v / 1000}k`}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="valor" fill="var(--color-valor)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Últimos Pagamentos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Data do Pagamento</TableHead>
                <TableHead className="text-right">Valor Pago</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagamentos.slice(0, 5).map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.expand?.colaborador_id?.nome}</TableCell>
                  <TableCell>{new Date(p.data_pagamento).toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell className="text-right text-emerald-600 font-medium">
                    {formatBRL(p.valor_pago)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
