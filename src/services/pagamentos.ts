import pb from '@/lib/pocketbase/client'
import { getAllPaginated } from '@/lib/pocketbase/helpers'

const PAGAMENTO_FIELDS =
  'id,colaborador_id,valor_pago,data_pagamento,foto_confirmacao,foto_confirmacao_url,status,tipo_pagamento,user_id,idtipopgto,horas,inicio,termino,registro,nome,filial,hora_pagamento,created,updated'

export const getPagamentos = () => getAllPaginated('pagamentos', { fields: PAGAMENTO_FIELDS })

export const getPagamento = (id: string) => pb.collection('pagamentos').getOne(id)

export const createPagamento = (data: any) => pb.collection('pagamentos').create(data)

export const updatePagamento = (id: string, data: any) =>
  pb.collection('pagamentos').update(id, data)

export const deletePagamento = (id: string) => pb.collection('pagamentos').delete(id)

export const batchConfirmPagamentos = async (payments: any[], photos: Record<number, File>) => {
  const formData = new FormData()
  formData.append('payments', JSON.stringify(payments))
  Object.entries(photos).forEach(([index, file]) => {
    if (file) formData.append(`photo_${index}`, file)
  })

  const response = await fetch(`${pb.baseURL}/backend/v1/pagamentos/batch-confirm`, {
    method: 'POST',
    headers: { Authorization: pb.authStore.token },
    body: formData,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Batch confirmation failed' }))
    throw new Error(error.message || `HTTP ${response.status}`)
  }

  return response.json()
}

export const getPagamentosTotals = async (filters: any) => {
  const filterConditions: string[] = []

  if (filters.search) {
    const isNumeric = /^\d+$/.test(filters.search)
    if (isNumeric) {
      filterConditions.push(`registro = "${filters.search}"`)
    } else {
      filterConditions.push(`(nome ~ "${filters.search}" || registro ~ "${filters.search}")`)
    }
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
    filterConditions.push(`updated >= "${filters.startDate} 00:00:00"`)
  }
  if (filters.endDate) {
    filterConditions.push(`updated <= "${filters.endDate} 23:59:59"`)
  }

  const filterString = filterConditions.length > 0 ? filterConditions.join(' && ') : undefined

  const records = await getAllPaginated('pagamentos', {
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
    const isNumeric = /^\d+$/.test(filters.search)
    if (isNumeric) {
      filterConditions.push(
        `(registro = "${filters.search}" || colaborador_id.registro = "${filters.search}")`,
      )
    } else {
      filterConditions.push(
        `(nome ~ "${filters.search}" || registro ~ "${filters.search}" || colaborador_id.nome ~ "${filters.search}" || colaborador_id.registro ~ "${filters.search}")`,
      )
    }
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
    filterConditions.push(`updated >= "${filters.startDate} 00:00:00"`)
  }
  if (filters.endDate) {
    filterConditions.push(`updated <= "${filters.endDate} 23:59:59"`)
  }

  const filterString = filterConditions.length > 0 ? filterConditions.join(' && ') : ''

  return pb.collection('pagamentos').getList(page, perPage, {
    filter: filterString,
    sort: '-updated',
    expand: 'colaborador_id',
    fields: PAGAMENTO_FIELDS,
  })
}

export const getPagamentosAnalytics = async (filters: any) => {
  const filterConditions: string[] = []

  if (filters.search) {
    const isNumeric = /^\d+$/.test(filters.search)
    if (isNumeric) {
      filterConditions.push(
        `(registro = "${filters.search}" || colaborador_id.registro = "${filters.search}")`,
      )
    } else {
      filterConditions.push(
        `(nome ~ "${filters.search}" || registro ~ "${filters.search}" || colaborador_id.nome ~ "${filters.search}" || colaborador_id.registro ~ "${filters.search}")`,
      )
    }
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
    filterConditions.push(`updated >= "${filters.startDate} 00:00:00"`)
  }
  if (filters.endDate) {
    filterConditions.push(`updated <= "${filters.endDate} 23:59:59"`)
  }

  const filterString = filterConditions.length > 0 ? filterConditions.join(' && ') : ''

  return getAllPaginated('pagamentos', {
    filter: filterString,
    expand: 'colaborador_id',
    fields: PAGAMENTO_FIELDS,
  })
}
