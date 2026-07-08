export const formatDataString = (dStr?: string) => {
  if (!dStr) return '-'
  const trimmed = dStr.trim()

  // Brazilian date format: dd/mm/yyyy — normalize and return
  const matchBr = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (matchBr) {
    return `${matchBr[1].padStart(2, '0')}/${matchBr[2].padStart(2, '0')}/${matchBr[3]}`
  }

  // ISO date or datetime: extract YYYY-MM-DD portion and convert to dd/mm/yyyy directly
  // (avoids Date object timezone shifting the day)
  const matchIso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (matchIso) {
    return `${matchIso[3]}/${matchIso[2]}/${matchIso[1]}`
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
  if (!horas && horas !== 0) return '00:00'

  const str = String(horas).trim()
  if (!str) return '00:00'

  if (str.includes(':')) {
    const parts = str.split(':')
    if (parts.length >= 2) {
      const h = String(parseInt(parts[0]) || 0).padStart(2, '0')
      const m = String(parseInt(parts[1]) || 0).padStart(2, '0')
      return `${h}:${m}`
    }
  }

  if (typeof horas === 'string' && (str.includes('.') || str.includes(','))) {
    const parts = str.split(/[.,]/)
    if (parts.length === 2) {
      const h = parseInt(parts[0]) || 0
      const m = parseInt(parts[1]) || 0
      if (m >= 0 && m <= 59) {
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
      }
    }
  }

  const val = parseFloat(str.replace(',', '.'))
  if (!isNaN(val)) {
    const totalMinutes = Math.round(val * 60)
    const h = Math.floor(totalMinutes / 60)
    const m = totalMinutes % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  return str || '00:00'
}

export const parseHorasToMinutes = (horas?: string | number): number => {
  if (!horas && horas !== 0) return 0

  const str = String(horas).trim()
  if (!str) return 0

  if (str.includes(':')) {
    const parts = str.split(':')
    if (parts.length >= 2) {
      return (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0)
    }
  }

  if (str.includes('.') || str.includes(',')) {
    const parts = str.split(/[.,]/)
    if (parts.length === 2) {
      const h = parseInt(parts[0]) || 0
      const m = parseInt(parts[1]) || 0
      if (m >= 0 && m <= 59) {
        return h * 60 + m
      }
    }
  }

  const val = parseFloat(str.replace(',', '.'))
  if (!isNaN(val)) {
    return Math.round(val * 60)
  }

  return 0
}

export const formatMinutesToHoras = (totalMinutes: number): string => {
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export const getTipoPagamento = (id?: number) => {
  if (id === 1) return 'Hora Extra'
  if (id === 3) return 'Férias Trabalhada'
  if (id === 4) return 'Vale Refeição'
  return 'Tipo desconhecido'
}

export const getTipoPagamentoAbrev = (tipo?: string | number) => {
  if (typeof tipo === 'number') {
    if (tipo === 1) return 'HE'
    if (tipo === 3) return 'FT'
    if (tipo === 4) return 'VR'
    return 'Tipo desconhecido'
  }
  if (typeof tipo === 'string') {
    const lower = tipo.toLowerCase()
    if (lower === 'hora extra' || lower.includes('hora') || lower === 'he') return 'HE'
    if (
      lower === 'férias trabalhada' ||
      lower.includes('férias') ||
      lower.includes('ferias') ||
      lower === 'ft'
    )
      return 'FT'
    if (
      lower === 'vale refeição' ||
      lower.includes('vale') ||
      lower.includes('refeição') ||
      lower.includes('refeicao') ||
      lower === 'vr'
    )
      return 'VR'
    return tipo
  }
  return 'Tipo desconhecido'
}

export const formatBRL = (val: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0)

export const formatDateTimeBR = (dateStr?: string | null): string => {
  if (!dateStr) return '-'

  let str = dateStr.trim()
  if (!str) return '-'

  // Brazilian date-only: dd/mm/yyyy — return as-is
  if (str.includes('/') && !str.includes(':')) return str

  // ISO date-only: YYYY-MM-DD — format directly without timezone shift
  if (str.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const parts = str.split('-')
    return `${parts[2]}/${parts[1]}/${parts[0]} às 00:00`
  }

  if (str.includes(' ') && !str.includes('T')) {
    str = str.replace(' ', 'T')
  }

  if (
    str.includes('T') &&
    !str.endsWith('Z') &&
    !str.includes('+') &&
    !str.match(/-\d{2}:\d{2}$/)
  ) {
    str += 'Z'
  }

  const date = new Date(str)
  if (isNaN(date.getTime())) return '-'

  // Convert UTC to Brazilian timezone (UTC-3) for display
  const localDate = new Date(date.getTime() - 3 * 3600000)

  const day = String(localDate.getUTCDate()).padStart(2, '0')
  const month = String(localDate.getUTCMonth() + 1).padStart(2, '0')
  const year = localDate.getUTCFullYear()
  const hours = String(localDate.getUTCHours()).padStart(2, '0')
  const minutes = String(localDate.getUTCMinutes()).padStart(2, '0')

  return `${day}/${month}/${year} às ${hours}:${minutes}`
}

export const getPaymentDisplayDate = (item: any): string | null => {
  const pag = item?.pagamento_relacionado

  const dataPagamento = pag?.data_pagamento || item?.data_pagamento
  const horaPagamento = pag?.hora_pagamento || item?.hora_pagamento

  if (dataPagamento) {
    const hasTime = dataPagamento.includes(' ') || dataPagamento.includes('T')
    if (!hasTime && horaPagamento) {
      return `${dataPagamento} ${horaPagamento}`
    }
    return dataPagamento
  }

  const hasPhoto = pag?.foto_confirmacao_url || item?.foto_confirmacao_url
  if (hasPhoto) {
    const updatedDate = pag?.updated || item?.updated
    if (updatedDate) return updatedDate
  }

  return null
}

export const formatDateDBToBR = (dStr?: string | null) => {
  if (!dStr) return 'N/A'
  const trimmed = String(dStr).trim()

  // Already in Brazilian format: dd/mm/yyyy
  const matchBr = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (matchBr) {
    return `${matchBr[1].padStart(2, '0')}/${matchBr[2].padStart(2, '0')}/${matchBr[3]}`
  }

  // Isolate the YYYY-MM-DD part from ISO strings to avoid timezone shifts
  const datePart = trimmed.split(' ')[0].split('T')[0]
  const parts = datePart.split('-')
  if (parts.length === 3 && parts[0].length === 4) {
    const [y, m, day] = parts
    return `${day}/${m}/${y}`
  }
  return dStr
}

export const checkIsLocked = (dataLiberacaoStr?: string) => {
  if (!dataLiberacaoStr) return false
  let cleanStr = dataLiberacaoStr
  if (cleanStr.includes(' ') && !cleanStr.includes('T')) cleanStr = cleanStr.replace(' ', 'T')
  if (
    !cleanStr.endsWith('Z') &&
    cleanStr.split('T').length === 2 &&
    !cleanStr.includes('+') &&
    !cleanStr.match(/-\d{2}:\d{2}$/)
  ) {
    cleanStr += 'Z'
  }
  const libDate = new Date(cleanStr)
  if (isNaN(libDate.getTime())) return false

  const now = new Date()
  return now.getTime() < libDate.getTime()
}

export const normalizeTimestampForSort = (dateStr?: string | null): string => {
  if (!dateStr) return ''
  let str = dateStr.trim()

  if (str.includes('T')) {
    if (!str.endsWith('Z') && !str.includes('+') && !str.match(/-\d{2}:\d{2}$/)) {
      str += 'Z'
    }
    return str
  }

  if (str.includes(' ') && str.match(/^\d{4}-\d{2}-\d{2}/)) {
    const spaceIdx = str.indexOf(' ')
    const datePart = str.substring(0, spaceIdx)
    let timePart = str.substring(spaceIdx + 1).trim()
    if (timePart.endsWith('Z')) timePart = timePart.slice(0, -1)
    if (timePart.length === 5) timePart += ':00'
    if (!timePart.includes('.')) timePart += '.000'
    return `${datePart}T${timePart}Z`
  }

  if (str.includes('/')) {
    const parts = str.split(' ')
    const datePart = parts[0]
    const timePart = parts[1] || '00:00:00'
    const dp = datePart.split('/')
    if (dp.length === 3) {
      let y: string, m: string, d: string
      if (dp[2].length === 4) {
        y = dp[2]
        m = dp[1]
        d = dp[0]
      } else {
        y = dp[0]
        m = dp[1]
        d = dp[2]
      }
      let t = timePart
      if (t.endsWith('Z')) t = t.slice(0, -1)
      if (t.length === 5) t += ':00'
      if (!t.includes('.')) t += '.000'
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${t}Z`
    }
  }

  if (str.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return str + 'T00:00:00.000Z'
  }

  return str
}

export const getBrasiliaStartUTC = (dateStr: string): string => {
  return `${dateStr} 03:00:00`
}

export const getBrasiliaEndUTC = (dateStr: string): string => {
  const date = new Date(dateStr + 'T00:00:00')
  date.setDate(date.getDate() + 1)
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} 02:59:59`
}

export const toBrasiliaDateString = (dateStr?: string | null): string | null => {
  if (!dateStr) return null
  let str = dateStr.trim()
  if (!str) return null

  if (str.includes(' ') && !str.includes('T')) {
    str = str.replace(' ', 'T')
  }

  if (
    str.includes('T') &&
    !str.endsWith('Z') &&
    !str.includes('+') &&
    !str.match(/-\d{2}:\d{2}$/)
  ) {
    str += 'Z'
  }

  const date = new Date(str)
  if (isNaN(date.getTime())) return null

  const localDate = new Date(date.getTime() - 3 * 3600000)

  const year = localDate.getUTCFullYear()
  const month = String(localDate.getUTCMonth() + 1).padStart(2, '0')
  const day = String(localDate.getUTCDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}
