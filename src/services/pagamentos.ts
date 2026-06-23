import pb from '@/lib/pocketbase/client'

export const getPagamentos = () => pb.collection('pagamentos').getFullList()

export const getPagamento = (id: string) => pb.collection('pagamentos').getOne(id)

export const createPagamento = (data: any) => pb.collection('pagamentos').create(data)

export const updatePagamento = (id: string, data: any) =>
  pb.collection('pagamentos').update(id, data)

export const deletePagamento = (id: string) => pb.collection('pagamentos').delete(id)

export const getPagamentosTotals = async (filters: any) => {
  const filterConditions: string[] = []

  if (filters.search) {
    filterConditions.push(`(nome ~ "${filters.search}" || registro ~ "${filters.search}")`)
  }

  if (filters.status && filters.status !== 'Todos') {
    filterConditions.push(`status = "${filters.status}"`)
  }

  if (filters.tipoPagamento && filters.tipoPagamento !== 'Todos') {
    filterConditions.push(`idtipopgto = ${filters.tipoPagamento}`)
  }

  if (filters.filial && filters.filial !== 'Todas') {
    const filialId = filters.filial === 'Cursino' ? 1 : filters.filial === 'Sapopemba' ? 2 : null
    if (filialId !== null) {
      filterConditions.push(`filial = ${filialId}`)
    }
  }

  if (filters.startDate) {
    filterConditions.push(
      `updated >= "${filters.startDate} 00:00:00" && foto_confirmacao_url != ""`,
    )
  }

  if (filters.endDate) {
    filterConditions.push(`updated <= "${filters.endDate} 23:59:59" && foto_confirmacao_url != ""`)
  }

  const filterString = filterConditions.length > 0 ? filterConditions.join(' && ') : undefined

  const records = await pb.collection('pagamentos').getFullList({
    filter: filterString,
    fields: 'valor_pago,status',
  })

  let pago = 0
  let pendente = 0

  records.forEach((r) => {
    if (r.status === 'Confirmado') {
      pago += r.valor_pago || 0
    } else if (r.status === 'Pendente') {
      pendente += r.valor_pago || 0
    }
  })

  return { pago, pendente }
}

export const getPagamentosPaginated = async (page: number, perPage: number, filters: any) => {
  const filterConditions: string[] = []

  if (filters.search) {
    filterConditions.push(
      `(nome ~ "${filters.search}" || registro ~ "${filters.search}" || colaborador_id.nome ~ "${filters.search}" || colaborador_id.registro ~ "${filters.search}")`,
    )
  }

  if (filters.status && filters.status !== 'Todos') {
    filterConditions.push(`status = "${filters.status}"`)
  }

  if (filters.tipoPagamento && filters.tipoPagamento !== 'Todos') {
    filterConditions.push(`idtipopgto = ${filters.tipoPagamento}`)
  }

  if (filters.filial && filters.filial !== 'Todas') {
    const filialId = filters.filial === 'Cursino' ? 1 : filters.filial === 'Sapopemba' ? 2 : null
    if (filialId !== null) {
      filterConditions.push(`(filial = ${filialId} || colaborador_id.filial = "${filters.filial}")`)
    } else {
      filterConditions.push(`colaborador_id.filial = "${filters.filial}"`)
    }
  }

  if (filters.referencia && filters.referencia !== 'Todas') {
    filterConditions.push(`colaborador_id.referencia = ${filters.referencia}`)
  }

  if (filters.startDate) {
    filterConditions.push(
      `updated >= "${filters.startDate} 00:00:00" && foto_confirmacao_url != ""`,
    )
  }

  if (filters.endDate) {
    filterConditions.push(`updated <= "${filters.endDate} 23:59:59" && foto_confirmacao_url != ""`)
  }

  const filterString = filterConditions.length > 0 ? filterConditions.join(' && ') : ''

  return pb.collection('pagamentos').getList(page, perPage, {
    filter: filterString,
    sort: '-updated',
    expand: 'colaborador_id',
  })
}

export const getPagamentosAnalytics = async (filters: any) => {
  const filterConditions: string[] = []

  if (filters.search) {
    filterConditions.push(
      `(nome ~ "${filters.search}" || registro ~ "${filters.search}" || colaborador_id.nome ~ "${filters.search}" || colaborador_id.registro ~ "${filters.search}")`,
    )
  }

  if (filters.status && filters.status !== 'Todos') {
    filterConditions.push(`status = "${filters.status}"`)
  }

  if (filters.tipoPagamento && filters.tipoPagamento !== 'Todos') {
    filterConditions.push(`idtipopgto = ${filters.tipoPagamento}`)
  }

  if (filters.filial && filters.filial !== 'Todas') {
    const filialId = filters.filial === 'Cursino' ? 1 : filters.filial === 'Sapopemba' ? 2 : null
    if (filialId !== null) {
      filterConditions.push(`(filial = ${filialId} || colaborador_id.filial = "${filters.filial}")`)
    } else {
      filterConditions.push(`colaborador_id.filial = "${filters.filial}"`)
    }
  }

  if (filters.referencia && filters.referencia !== 'Todas') {
    filterConditions.push(`colaborador_id.referencia = ${filters.referencia}`)
  }

  if (filters.startDate) {
    filterConditions.push(
      `updated >= "${filters.startDate} 00:00:00" && foto_confirmacao_url != ""`,
    )
  }

  if (filters.endDate) {
    filterConditions.push(`updated <= "${filters.endDate} 23:59:59" && foto_confirmacao_url != ""`)
  }

  const filterString = filterConditions.length > 0 ? filterConditions.join(' && ') : ''

  return pb.collection('pagamentos').getFullList({
    filter: filterString,
    expand: 'colaborador_id',
  })
}
