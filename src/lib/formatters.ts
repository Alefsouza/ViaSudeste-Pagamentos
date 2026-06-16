export const formatDataString = (dStr?: string) => {
  if (!dStr) return '-'
  if (dStr.includes('/')) return dStr
  if (dStr.includes('-')) {
    const parts = dStr.split(' ')[0].split('-')
    if (parts.length === 3) {
      if (parts[0].length === 4) return `${parts[2]}/${parts[1]}/${parts[0]}`
      return `${parts[0]}/${parts[1]}/${parts[2]}`
    }
  }
  return dStr
}

export const formatHoraString = (hStr?: string) => {
  if (!hStr) return '--:--'
  const match = hStr.match(/(\d{1,2})[^\d]?(\d{2})/)
  if (match) {
    return `${match[1].padStart(2, '0')}:${match[2]}`
  }
  return hStr
}

export const formatHoras = (horas?: string | number) => {
  if (!horas) return '00.00'
  const val = Number(horas)
  if (isNaN(val)) return String(horas)
  return val.toFixed(2).padStart(5, '0')
}

export const getTipoPagamento = (id?: number) => {
  if (id === 1) return 'Hora Extra'
  if (id === 3) return 'Férias Trabalhada'
  if (id === 4) return 'Vale Refeição'
  return 'Tipo desconhecido'
}

export const formatBRL = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)

export const parseLocalDate = (dStr?: string) => {
  if (!dStr) return null
  const datePart = dStr.split(' ')[0]
  if (datePart.includes('-')) {
    const parts = datePart.split('-')
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
      }
      return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]))
    }
  }
  if (datePart.includes('/')) {
    const parts = datePart.split('/')
    if (parts.length === 3) {
      return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]))
    }
  }
  return new Date(dStr)
}

export const checkIsLocked = (p: any) => {
  if (!p) return false
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const dataLib = parseLocalDate(p.data_liberacao)
  if (dataLib && dataLib > startOfToday) return true

  const dataPag = parseLocalDate(p.data_pagamento_v2 || p.expand?.colaborador_id?.data_pagamento_v2)
  if (dataPag && dataPag > startOfToday) return true

  const dataPagPagamento = parseLocalDate(p.data_pagamento)
  if (dataPagPagamento && dataPagPagamento > startOfToday) return true

  return false
}
