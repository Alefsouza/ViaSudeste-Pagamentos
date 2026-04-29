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
import { LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar } from 'recharts'
import { Users, TrendingUp, AlertTriangle, Activity } from 'lucide-react'

const salesData = [
  { time: '08:00', sales: 1200 },
  { time: '10:00', sales: 2100 },
  { time: '12:00', sales: 3400 },
  { time: '14:00', sales: 2800 },
  { time: '16:00', sales: 4200 },
  { time: '18:00', sales: 3800 },
]

const cashierData = [
  { name: 'Ana', ops: 145 },
  { name: 'Carlos', ops: 132 },
  { name: 'Beatriz', ops: 168 },
  { name: 'João', ops: 110 },
]

export default function Dashboard() {
  return (
    <div className="container mx-auto py-8 px-4 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
          Painel do Gestor
        </h1>
        <p className="text-muted-foreground mt-1">Visão geral da operação em tempo real.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { title: 'Vendas Hoje', value: 'R$ 17.500', icon: TrendingUp, color: 'text-emerald-500' },
          { title: 'Caixas Ativos', value: '12/15', icon: Users, color: 'text-blue-500' },
          { title: 'Alertas', value: '3', icon: AlertTriangle, color: 'text-amber-500' },
          { title: 'Taxa de Conversão', value: '68%', icon: Activity, color: 'text-purple-500' },
        ].map((stat, i) => (
          <Card key={i} className="animate-fade-in-up" style={{ animationDelay: `${i * 100}ms` }}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Vendas por Hora</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{ sales: { label: 'Vendas', color: 'hsl(var(--primary))' } }}
              className="h-[300px] w-full"
            >
              <LineChart data={salesData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `R$${v / 1000}k`}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="sales"
                  stroke="var(--color-sales)"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Operações por Caixa</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{ ops: { label: 'Operações', color: '#10b981' } }}
              className="h-[300px] w-full"
            >
              <BarChart data={cashierData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis fontSize={12} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="ops" fill="var(--color-ops)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Atividade Recente</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operador</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Terminal</TableHead>
                <TableHead className="text-right">Horário</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                { op: 'Ana S.', action: 'Login Realizado', terminal: 'CX-04', time: '14:23' },
                { op: 'Carlos M.', action: 'Pausa (Almoço)', terminal: 'CX-02', time: '14:15' },
                { op: 'Beatriz L.', action: 'Login Realizado', terminal: 'CX-07', time: '13:50' },
              ].map((row, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium text-slate-900 dark:text-slate-100">
                    {row.op}
                  </TableCell>
                  <TableCell>{row.action}</TableCell>
                  <TableCell>{row.terminal}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{row.time}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
