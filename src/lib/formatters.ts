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
