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

export const formatDateDBToBR = (dStr?: string | null) => {
  if (!dStr) return 'N/A'
  const datePart = dStr.split(' ')[0]
  const parts = datePart.split('-')
  if (parts.length === 3) {
    const [y, m, day] = parts
    return `${day}/${m}/${y}`
  }
  return dStr
}

export const checkIsLocked = (dataLiberacaoStr?: string) => {
  if (!dataLiberacaoStr) return false
  const dataLiberacaoDate = new Date(dataLiberacaoStr)
  if (isNaN(dataLiberacaoDate.getTime())) return false
  const agoraUtc3 = new Date(Date.now() - 3 * 3600000)
  const todayStr = `${agoraUtc3.getUTCFullYear()}-${String(agoraUtc3.getUTCMonth() + 1).padStart(2, '0')}-${String(agoraUtc3.getUTCDate()).padStart(2, '0')}`
  const libStr = `${dataLiberacaoDate.getUTCFullYear()}-${String(dataLiberacaoDate.getUTCMonth() + 1).padStart(2, '0')}-${String(dataLiberacaoDate.getUTCDate()).padStart(2, '0')}`
  return todayStr < libStr
}
