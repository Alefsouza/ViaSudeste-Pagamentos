import pb from '@/lib/pocketbase/client'

export const getColaboradores = async () => {
  return pb.collection('colaboradores').getFullList({ expand: 'colaborador_id' })
}

export const updateColaborador = async (id: string, data: any) => {
  return pb.collection('colaboradores').update(id, data)
}

function getDatesInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  let currentDate = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  let count = 0
  while (currentDate <= end && count < 366) {
    const d = String(currentDate.getDate()).padStart(2, '0')
    const m = String(currentDate.getMonth() + 1).padStart(2, '0')
    const y = currentDate.getFullYear()
    dates.push(`${d}/${m}/${y}`)
    currentDate.setDate(currentDate.getDate() + 1)
    count++
  }
  return dates
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
      conditions.push(`foto_confirmacao_url != ""`)
    } else {
      conditions.push(`foto_confirmacao_url = ""`)
    }
  }
  if (filters.tipoPagamento && filters.tipoPagamento !== 'Todos') {
    conditions.push(`idtipopgto = ${filters.tipoPagamento}`)
  }
  if (filters.referencia && filters.referencia !== 'Todas') {
    conditions.push(`referencia = ${filters.referencia}`)
  }

  if (filters.data_pagamento_text) {
    conditions.push(`data_pagamento ~ "${filters.data_pagamento_text}"`)
  } else if (filters.startDate && filters.startDate === filters.endDate) {
    const d = filters.startDate.split('-')
    if (d.length === 3) {
      conditions.push(`data_pagamento = "${d[2]}/${d[1]}/${d[0]}"`)
    }
  } else if (filters.startDate && filters.endDate) {
    const dates = getDatesInRange(filters.startDate, filters.endDate)
    if (dates.length > 0) {
      const dateFilters = dates.map((d) => `data_pagamento = "${d}"`).join(' || ')
      conditions.push(`(${dateFilters})`)
    } else {
      conditions.push(`data_pagamento = "NON_EXISTENT"`)
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
