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

export interface PagamentosDashboardTotals {
  totals: {
    pago: number
    pendente: number
    pagoVR: number
    pagoHE: number
    pagoFT: number
    pagoAP: number
    pendenteVR: number
    pendenteHE: number
    pendenteFT: number
    pendenteAP: number
    confirmadoCount: number
    pendenteCount: number
    totalColaboradores?: number
  }
  maxRef: number
  referencias: Array<{
    referencia: number
    pago?: number
    pendente?: number
    total_pago: number
    total_pendente?: number
    periodo_inicio: string | null
    periodo_fim: string | null
  }>
  filiais?: Array<{
    name: string
    value: number
  }>
  dias?: Array<{
    date: string
    formattedDate: string
    total: number
  }>
  tiposPagamento?: string[]
}

export const fetchDashboardTotals = async (): Promise<PagamentosDashboardTotals> => {
  return pb.send<PagamentosDashboardTotals>('/backend/v1/pagamentos/totals', {
    method: 'GET',
  })
}

export const getPagamentosTotals = async (filters: any) => {
  const filterConditions: string[] = []

  if (filters.search) {
    const term = String(filters.search).trim()
    if (term) {
      const isNumeric = /^\d+$/.test(term)
      if (isNumeric) {
        filterConditions.push(`registro = "${term}"`)
      } else {
        filterConditions.push(`nome ~ "${term}"`)
      }
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
    const term = String(filters.search).trim()
    if (term) {
      const isNumeric = /^\d+$/.test(term)
      if (isNumeric) {
        filterConditions.push(`(registro = "${term}" || colaborador_id.registro = "${term}")`)
      } else {
        filterConditions.push(`(nome ~ "${term}" || colaborador_id.nome ~ "${term}")`)
      }
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
    const term = String(filters.search).trim()
    if (term) {
      const isNumeric = /^\d+$/.test(term)
      if (isNumeric) {
        filterConditions.push(`(registro = "${term}" || colaborador_id.registro = "${term}")`)
      } else {
        filterConditions.push(`(nome ~ "${term}" || colaborador_id.nome ~ "${term}")`)
      }
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

// Na listagem/tabela do Dashboard a foto só é exibida ao clicar em visualizar (sob demanda).
// Mantemos foto_confirmacao_url se necessário ou podemos carregar sob demanda,
// mas o item 4 pede: "a consulta de colaboradores que alimenta a tabela do Dashboard não deve incluir o campo foto/foto_confirmacao_url na carga inicial".
// Para pagamentos mantemos campos leves essenciais.
const PAGAMENTOS_FOR_COLABS_FIELDS =
  'id,colaborador_id,status,valor_pago,data_pagamento,hora_pagamento,foto_confirmacao_url,updated,created'

export const getPagamentosByDateBrasilia = async (dateStr: string) => {
  // dateStr é esperado no formato "YYYY-MM-DD"
  // Intervalo do dia em UTC para cobrir UTC-3 (03:00:00 do dia até 02:59:59 do dia seguinte)
  const parts = dateStr.split('-')
  if (parts.length !== 3) return []
  const yyyy = parseInt(parts[0], 10)
  const mm = parseInt(parts[1], 10) - 1
  const dd = parseInt(parts[2], 10)

  const startUTC = `${dateStr} 03:00:00.000Z`
  const nextDay = new Date(Date.UTC(yyyy, mm, dd + 1))
  const nextY = nextDay.getUTCFullYear()
  const nextM = String(nextDay.getUTCMonth() + 1).padStart(2, '0')
  const nextD = String(nextDay.getUTCDate()).padStart(2, '0')
  const endUTC = `${nextY}-${nextM}-${nextD} 02:59:59.999Z`

  // Consulta direta por data_pagamento na faixa UTC correspondente ao dia de Brasília
  const filterString = `status = "Confirmado" && data_pagamento >= "${startUTC}" && data_pagamento <= "${endUTC}"`

  return getAllPaginated('pagamentos', {
    filter: filterString,
    fields: PAGAMENTO_FIELDS + ',observacao',
    fallbackOn429: true,
  })
}

export const getPagamentosForColaboradoresFilter = async (filters: any) => {
  const filterConditions: string[] = ['status = "Confirmado"']

  if (filters.search) {
    const term = String(filters.search).trim()
    if (term) {
      const isNumeric = /^\d+$/.test(term)
      if (isNumeric) {
        filterConditions.push(`(registro = "${term}" || colaborador_id.registro = "${term}")`)
      } else {
        filterConditions.push(`(nome ~ "${term}" || colaborador_id.nome ~ "${term}")`)
      }
    }
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

  const hasSpecificRef = Boolean(
    (filters.referencia && filters.referencia !== 'Todas') ||
    (filters.chartRefs && Array.isArray(filters.chartRefs) && filters.chartRefs.length > 0),
  )
  const hasSearch = Boolean(filters.search && String(filters.search).trim())

  if (filters.referencia && filters.referencia !== 'Todas') {
    filterConditions.push(`colaborador_id.referencia = ${filters.referencia}`)
  } else if (
    filters.chartRefs &&
    Array.isArray(filters.chartRefs) &&
    filters.chartRefs.length > 0
  ) {
    if (filters.chartRefs.length === 1) {
      filterConditions.push(`colaborador_id.referencia = ${filters.chartRefs[0]}`)
    } else {
      filterConditions.push(
        `(${filters.chartRefs.map((r: any) => `colaborador_id.referencia = ${r}`).join(' || ')})`,
      )
    }
  } else if (!hasSpecificRef && !hasSearch && filters.minReferencia && filters.minReferencia > 0) {
    // Restringe aos pagamentos da janela de referências ativas (ex: últimas 6 referências)
    // ou pagamentos de colaboradores liberados
    filterConditions.push(
      `(colaborador_id.referencia >= ${filters.minReferencia} || colaborador_id.liberado_pagamento = true)`,
    )
  }

  const filterString = filterConditions.join(' && ')

  return getAllPaginated('pagamentos', {
    filter: filterString,
    fields: PAGAMENTOS_FOR_COLABS_FIELDS,
    fallbackOn429: true,
  })
}
