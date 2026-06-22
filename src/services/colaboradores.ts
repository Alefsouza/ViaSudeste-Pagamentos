import pb from '@/lib/pocketbase/client'

export const getColaboradores = async () => {
  return pb.collection('colaboradores').getFullList({ expand: 'colaborador_id' })
}

export const updateColaborador = async (id: string, data: any) => {
  return pb.collection('colaboradores').update(id, data)
}

const buildFilterString = (filters: any) => {
  const conditions: string[] = []

  if (filters.search) {
    conditions.push(`(nome ~ "${filters.search}" || registro ~ "${filters.search}")`)
  }
  if (filters.filial && filters.filial !== 'Todas') {
    conditions.push(`filial = "${filters.filial}"`)
  }
  if (filters.status && filters.status !== 'Todos') {
    if (filters.status === 'Confirmado') {
      conditions.push(`(status = "Confirmado" || foto_confirmacao_url != "")`)
    } else {
      conditions.push(`status = "${filters.status}"`)
    }
  }
  if (filters.tipoPagamento && filters.tipoPagamento !== 'Todos') {
    conditions.push(`idtipopgto = ${filters.tipoPagamento}`)
  }
  if (filters.referencia && filters.referencia !== 'Todas') {
    conditions.push(`referencia = ${filters.referencia}`)
  }

  // Strict data_pagamento text filter if provided
  if (filters.data_pagamento_text) {
    conditions.push(`data_pagamento ~ "${filters.data_pagamento_text}"`)
  } else {
    if (filters.startDate) {
      conditions.push(`created >= "${filters.startDate} 00:00:00"`)
    }
    if (filters.endDate) {
      conditions.push(`created <= "${filters.endDate} 23:59:59"`)
    }
  }

  return conditions.length > 0 ? conditions.join(' && ') : undefined
}

export const getColaboradoresPaginated = async (
  page: number,
  perPage: number,
  filters: any = {},
) => {
  const filterString = buildFilterString(filters)

  return pb.collection('colaboradores').getList(page, perPage, {
    filter: filterString,
    sort: '-created',
    expand: 'colaborador_id',
  })
}

export const getColaboradoresAnalytics = async (filters: any = {}) => {
  const filterString = buildFilterString(filters)

  return pb.collection('colaboradores').getFullList({
    filter: filterString,
    sort: '-created',
    expand: 'colaborador_id',
  })
}

export const getColaboradoresStats = async (filters: any = {}) => {
  return pb.collection('colaboradores').getFullList({ filter: buildFilterString(filters) })
}

export const getColaboradorByRegistro = async (registro: string) => {
  return pb.collection('colaboradores').getFirstListItem(`registro = "${registro}"`)
}
