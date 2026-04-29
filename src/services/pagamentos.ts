import pb from '@/lib/pocketbase/client'

export const getPagamentos = () =>
  pb.collection('pagamentos').getFullList({ expand: 'colaborador_id', sort: '-created' })

export const createPagamento = (data: {
  colaborador_id: string
  valor_pago: number
  data_pagamento: string
  foto_confirmacao?: File
}) => pb.collection('pagamentos').create(data)

const buildFilter = (filters: any) => {
  const parts: string[] = []
  if (filters.startDate) parts.push(`data_pagamento >= '${filters.startDate} 00:00:00'`)
  if (filters.endDate) parts.push(`data_pagamento <= '${filters.endDate} 23:59:59'`)
  if (filters.filial && filters.filial !== 'Todas')
    parts.push(`colaborador_id.filial = '${filters.filial}'`)
  if (filters.search) {
    parts.push(
      `(colaborador_id.nome ~ '${filters.search}' || colaborador_id.registro ~ '${filters.search}')`,
    )
  }
  return parts.join(' && ')
}

export const getPagamentosPaginated = async (page: number, perPage: number, filters: any) => {
  return pb.collection('pagamentos').getList(page, perPage, {
    filter: buildFilter(filters),
    expand: 'colaborador_id',
    sort: '-data_pagamento',
  })
}

export const getPagamentosAnalytics = async (filters: any) => {
  return pb.collection('pagamentos').getFullList({
    filter: buildFilter(filters),
    expand: 'colaborador_id',
    fields:
      'id,valor_pago,data_pagamento,colaborador_id,expand.colaborador_id.filial,expand.colaborador_id.nome,expand.colaborador_id.registro,expand.colaborador_id.id',
  })
}

export const getPagamentosStats = async (filters: any) => {
  const records = await pb.collection('pagamentos').getFullList({
    filter: buildFilter(filters),
    fields: 'valor_pago',
  })

  return {
    count: records.length,
    total: records.reduce((acc, record) => acc + (record.valor_pago || 0), 0),
  }
}
