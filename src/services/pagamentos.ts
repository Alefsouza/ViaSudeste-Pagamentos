import pb from '@/lib/pocketbase/client'

export const getPagamentos = () =>
  pb.collection('pagamentos').getFullList({ expand: 'colaborador_id', sort: '-created' })

export const createPagamento = (data: {
  colaborador_id: string
  valor_pago: number
  data_pagamento: string
  hora_pagamento?: string
  foto_confirmacao?: File
  foto_confirmacao_url?: string
  user_id?: string
  status?: string
  inicio?: string
  termino?: string
  horas?: number
  idtipopgto?: number
  tipo_pagamento?: string
}) => pb.collection('pagamentos').create(data)

export const updatePagamento = (id: string, data: Partial<{ foto_confirmacao_url: string }>) =>
  pb.collection('pagamentos').update(id, data)

export const updatePagamentoCompleto = (id: string, data: any) =>
  pb.collection('pagamentos').update(id, data)

export const getPagamentoByRegistro = async (registro: string) => {
  try {
    const records = await pb.collection('pagamentos').getList(1, 1, {
      filter: `colaborador_id.registro = '${registro}' && status = 'Pendente'`,
      sort: '-created',
    })
    if (records.items.length === 0) {
      const allRecords = await pb.collection('pagamentos').getList(1, 1, {
        filter: `colaborador_id.registro = '${registro}'`,
        sort: '-created',
      })
      return allRecords.items[0] || null
    }
    return records.items[0] || null
  } catch (err) {
    return null
  }
}

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

export const getRecebedoriaPagamentosPaginated = async (
  page: number,
  perPage: number,
  filters: any,
  userId: string,
) => {
  const parts: string[] = [`user_id = '${userId}'`]

  if (filters.startDate) parts.push(`data_pagamento >= '${filters.startDate} 00:00:00'`)
  if (filters.endDate) parts.push(`data_pagamento <= '${filters.endDate} 23:59:59'`)
  if (filters.search) {
    parts.push(
      `(colaborador_id.nome ~ '${filters.search}' || colaborador_id.registro ~ '${filters.search}')`,
    )
  }
  if (filters.status && filters.status !== 'Todos') parts.push(`status = '${filters.status}'`)

  return pb.collection('pagamentos').getList(page, perPage, {
    filter: parts.join(' && '),
    expand: 'colaborador_id,user_id',
    sort: '-data_pagamento',
  })
}
