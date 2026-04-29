import { createPortal } from 'react-dom'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart'

interface PrintableReportProps {
  data: any[]
  type: 'table' | 'full'
  filters: { startDate: string; endDate: string; filial: string }
}

export function PrintableReport({ data, type, filters }: PrintableReportProps) {
  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
  const formatDateTime = (isoString: string) => {
    const d = new Date(isoString)
    return {
      date: d.toLocaleDateString('pt-BR'),
      time: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    }
  }

  const totalPago = data.reduce((sum, item) => sum + item.valor_pago, 0)
  const count = data.length
  const uniqueCols = new Set(data.map((item) => item.colaborador_id)).size
  const maxVal = count ? Math.max(...data.map((item) => item.valor_pago)) : 0
  const minVal = count ? Math.min(...data.map((item) => item.valor_pago)) : 0
  const avgVal = count ? totalPago / count : 0

  const byFilial = data.reduce((acc: any, item: any) => {
    const f = item.expand?.colaborador_id?.filial || 'Desconhecida'
    acc[f] = (acc[f] || 0) + item.valor_pago
    return acc
  }, {})

  const pieData = Object.entries(byFilial).map(([name, value], i) => ({
    name,
    value,
    fill: `hsl(var(--chart-${(i % 5) + 1}))`,
  }))

  const pieConfig = Object.keys(byFilial).reduce((acc: any, key, i) => {
    acc[key] = { label: key, color: `hsl(var(--chart-${(i % 5) + 1}))` }
    return acc
  }, {})

  const byDay = data.reduce((acc: any, item: any) => {
    const date = item.data_pagamento.split(' ')[0]
    acc[date] = (acc[date] || 0) + item.valor_pago
    return acc
  }, {})

  const barData = Object.entries(byDay)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, total]) => ({
      date: new Date(date + 'T12:00:00').toLocaleDateString('pt-BR'),
      total,
    }))

  const barConfig = { total: { label: 'Total Pago', color: 'hsl(var(--chart-1))' } }

  const content = (
    <div className="hidden print:block p-8 bg-white text-black w-full">
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: white; margin: 0; }
          @page { size: A4; margin: 10mm; }
          #root { display: none !important; }
        }
      `}</style>
      <div className="mb-6 border-b pb-4 border-slate-200">
        <h1 className="text-3xl font-bold mb-2">Relatório de Pagamentos</h1>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p>
              <span className="font-semibold">Data de Geração:</span>{' '}
              {new Date().toLocaleString('pt-BR')}
            </p>
            <p>
              <span className="font-semibold">Período:</span>{' '}
              {new Date(filters.startDate + 'T12:00:00').toLocaleDateString('pt-BR')} -{' '}
              {new Date(filters.endDate + 'T12:00:00').toLocaleDateString('pt-BR')}
            </p>
          </div>
          <div>
            <p>
              <span className="font-semibold">Filial:</span> {filters.filial}
            </p>
          </div>
        </div>
      </div>

      {type === 'full' && (
        <div className="mb-8 page-break-inside-avoid">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="border border-slate-200 p-4 rounded-lg bg-slate-50">
              <p className="text-sm text-slate-500 font-medium">Total Pago</p>
              <p className="text-xl font-bold">{formatBRL(totalPago)}</p>
            </div>
            <div className="border border-slate-200 p-4 rounded-lg bg-slate-50">
              <p className="text-sm text-slate-500 font-medium">Qtd. Colaboradores</p>
              <p className="text-xl font-bold">{uniqueCols}</p>
            </div>
            <div className="border border-slate-200 p-4 rounded-lg bg-slate-50">
              <p className="text-sm text-slate-500 font-medium">Valor Médio</p>
              <p className="text-xl font-bold">{formatBRL(avgVal)}</p>
            </div>
            <div className="border border-slate-200 p-4 rounded-lg bg-slate-50">
              <p className="text-sm text-slate-500 font-medium">Maior Valor</p>
              <p className="text-xl font-bold">{formatBRL(maxVal)}</p>
            </div>
            <div className="border border-slate-200 p-4 rounded-lg bg-slate-50">
              <p className="text-sm text-slate-500 font-medium">Menor Valor</p>
              <p className="text-xl font-bold">{formatBRL(minVal)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-6">
            <div className="border border-slate-200 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-4 text-center">Distribuição por Filial</h3>
              <div className="flex justify-center">
                <ChartContainer config={pieConfig} className="w-[300px] h-[300px]">
                  <PieChart width={300} height={300}>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      isAnimationActive={false}
                      label
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                  </PieChart>
                </ChartContainer>
              </div>
            </div>
            <div className="border border-slate-200 p-4 rounded-lg">
              <h3 className="text-lg font-semibold mb-4 text-center">Total Pago por Dia</h3>
              <div className="flex justify-center">
                <ChartContainer config={barConfig} className="w-[300px] h-[300px]">
                  <BarChart
                    width={300}
                    height={300}
                    data={barData}
                    margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" />
                    <YAxis tickFormatter={(val) => `R$${val}`} tick={{ fontSize: 10 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar
                      dataKey="total"
                      fill="var(--color-total)"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ChartContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold mb-4">Detalhamento dos Pagamentos</h3>
        <table className="w-full text-sm text-left border-collapse border border-slate-300">
          <thead className="bg-slate-100 border-b border-slate-300">
            <tr>
              <th className="p-2 border border-slate-300">Nome</th>
              <th className="p-2 border border-slate-300">Registro</th>
              <th className="p-2 border border-slate-300">Filial</th>
              <th className="p-2 border border-slate-300 text-center">Data</th>
              <th className="p-2 border border-slate-300 text-center">Hora</th>
              <th className="p-2 border border-slate-300 text-right">Valor Pago</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item: any) => {
              const { date, time } = formatDateTime(item.data_pagamento)
              const colab = item.expand?.colaborador_id
              return (
                <tr key={item.id} className="border-b border-slate-200">
                  <td className="p-2 border border-slate-200">{colab?.nome}</td>
                  <td className="p-2 border border-slate-200">{colab?.registro}</td>
                  <td className="p-2 border border-slate-200">{colab?.filial}</td>
                  <td className="p-2 border border-slate-200 text-center">{date}</td>
                  <td className="p-2 border border-slate-200 text-center">{time}</td>
                  <td className="p-2 border border-slate-200 text-right">
                    {formatBRL(item.valor_pago)}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="bg-slate-50 font-bold border-t-2 border-slate-300">
            <tr>
              <td colSpan={5} className="p-2 border border-slate-300 text-right">
                Total de pagamentos: {count}
              </td>
              <td className="p-2 border border-slate-300 text-right text-emerald-600">
                {formatBRL(totalPago)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
