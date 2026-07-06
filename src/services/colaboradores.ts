import pb from '@/lib/pocketbase/client'
import { getAllPaginated } from '@/lib/pocketbase/helpers'

const COLAB_FIELDS =
  'id,registro,nome,valor_a_receber,valor,filial,filial_id,referencia,idtipopgto,foto_confirmacao_url,liberado_pagamento,data_liberacao,data_pagamento,data_pagamento_v2,data,hora_pagamento,updated,created,periodo_inicio,periodo_fim,inicio,termino,horas'

const PAGAMENTO_FIELDS =
  'id,colaborador_id,status,valor_pago,data_pagamento,data_pagamento_v2,hora_pagamento,foto_confirmacao_url,updated,created'

export const getColaboradores = async () => {
  return getAllPaginated('colaboradores', { fields: COLAB_FIELDS, sort: '-created' })
}

export const updateColaborador = async (id: string, data: any) => {
  return pb.collection('colaboradores').update(id, data)
}

const buildFilterString = (filters: any, prefix = '') => {
  const conditions: string[] = []

  if (filters.search) {
    const isNumeric = /^\d+$/.test(filters.search)
    if (isNumeric) {
      conditions.push(`(${prefix}registro = "${filters.search}")`)
    } else {
      conditions.push(
        `(${prefix}nome ~ "${filters.search}" || ${prefix}registro ~ "${filters.search}")`,
      )
    }
  }
  if (filters.filial && filters.filial !== 'Todas') {
    conditions.push(`${prefix}filial = "${filters.filial}"`)
  }
  if (filters.status && filters.status !== 'Todos') {
    if (filters.status === 'Confirmado') {
      conditions.push(`${prefix}foto_confirmacao_url != ""`)
    } else {
      conditions.push(`${prefix}foto_confirmacao_url = ""`)
    }
  }
  if (filters.tipoPagamento && filters.tipoPagamento !== 'Todos') {
    conditions.push(`${prefix}idtipopgto = ${filters.tipoPagamento}`)
  }
  if (filters.referencia && filters.referencia !== 'Todas') {
    conditions.push(`${prefix}referencia = ${filters.referencia}`)
  }

  if (filters.data_pagamento_text) {
    conditions.push(
      `(${prefix}data_pagamento ~ "${filters.data_pagamento_text}" || ${prefix}data ~ "${filters.data_pagamento_text}")`,
    )
  } else if (filters.startDate && filters.endDate) {
    conditions.push(
      `(${prefix}data_pagamento_v2 >= "${filters.startDate} 00:00:00" && ${prefix}data_pagamento_v2 <= "${filters.endDate} 23:59:59")`,
    )
  } else if (filters.startDate) {
    conditions.push(`${prefix}data_pagamento_v2 >= "${filters.startDate} 00:00:00"`)
  } else if (filters.endDate) {
    conditions.push(`${prefix}data_pagamento_v2 <= "${filters.endDate} 23:59:59"`)
  }

  return conditions.length > 0 ? conditions.join(' && ') : undefined
}

export const fetchPagamentosForColabs = async (colabIds: string[]) => {
  if (colabIds.length === 0) return []
  const chunkSize = 100
  const allPags = []
  for (let i = 0; i < colabIds.length; i += chunkSize) {
    const chunk = colabIds.slice(i, i + chunkSize)
    const filter = chunk.map((id) => `colaborador_id="${id}"`).join(' || ')
    const pags = await getAllPaginated('pagamentos', { filter, fields: PAGAMENTO_FIELDS })
    allPags.push(...pags)
  }
  return allPags
}

export const getPagamentosForColaboradoresFilter = async (filters: any = {}) => {
  const filterString = buildFilterString(filters, 'colaborador_id.')
  const finalFilter = filterString
    ? `(${filterString}) && status = "Confirmado"`
    : `status = "Confirmado"`
  return getAllPaginated('pagamentos', { filter: finalFilter, fields: PAGAMENTO_FIELDS })
}

export const getColaboradoresPaginated = async (
  page: number,
  perPage: number,
  filters: any = {},
) => {
  const filterString = buildFilterString(filters)

  return pb.collection('colaboradores').getList(page, perPage, {
    filter: filterString,
    sort: '-referencia,-created',
    fields: COLAB_FIELDS,
  })
}

export const getColaboradoresAnalytics = async (filters: any = {}) => {
  const filterString = buildFilterString(filters)

  return getAllPaginated('colaboradores', {
    filter: filterString,
    sort: '-referencia,-created',
    fields: COLAB_FIELDS,
  })
}

export const getColaboradoresStats = async (filters: any = {}) => {
  return getAllPaginated('colaboradores', {
    filter: buildFilterString(filters),
    fields:
      'id,valor_a_receber,valor,referencia,foto_confirmacao_url,liberado_pagamento,idtipopgto',
  })
}

export const getColaboradorByRegistro = async (registro: string) => {
  return pb.collection('colaboradores').getFirstListItem(`registro = "${registro}"`)
}
