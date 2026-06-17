import pb from '@/lib/pocketbase/client'

export const getColaboradores = () => pb.collection('colaboradores').getFullList({ sort: 'nome' })

export const updateColaborador = (
  id: string,
  data: Partial<{ foto_confirmacao_url: string; liberado_pagamento: boolean }>,
) => pb.collection('colaboradores').update(id, data)

const colabCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

const buildFilterStr = (filters: any) => {
  const { search, startDate, endDate, filial, status, tipoPagamento } = filters
  let filterStr = []

  if (search) {
    const trimmed = search.trim()
    const isNumeric = !isNaN(Number(trimmed)) && trimmed !== ''
    if (isNumeric) {
      filterStr.push(`(nome~"${search}" || registro~"${search}" || referencia=${trimmed})`)
    } else {
      filterStr.push(`(nome~"${search}" || registro~"${search}")`)
    }
  }
  if (filial && filial !== 'Todas') {
    filterStr.push(`filial="${filial}"`)
  }
  if (startDate) {
    filterStr.push(`created >= "${startDate} 00:00:00"`)
  }
  if (endDate) {
    filterStr.push(`created <= "${endDate} 23:59:59"`)
  }
  if (status === 'Confirmado') {
    filterStr.push(`foto_confirmacao_url != ""`)
  } else if (status === 'Pendente') {
    filterStr.push(`(foto_confirmacao_url = "" || foto_confirmacao_url = null)`)
  }
  if (tipoPagamento && tipoPagamento !== 'Todos') {
    filterStr.push(`idtipopgto=${tipoPagamento}`)
  }
  if (filters.referencia && filters.referencia !== 'Todas') {
    filterStr.push(`referencia=${filters.referencia}`)
  }

  return filterStr.join(' && ')
}

export const getColaboradoresPaginated = async (page: number, perPage: number, filters: any) => {
  return pb.collection('colaboradores').getList(page, perPage, {
    filter: buildFilterStr(filters),
    sort: '-data,-created',
  })
}

export const getColaboradoresStats = async (filters: any) => {
  const records = await pb.collection('colaboradores').getFullList({
    filter: buildFilterStr(filters),
    fields: 'valor_a_receber,valor',
  })

  const total = records.reduce((acc, curr) => acc + (curr.valor_a_receber || curr.valor || 0), 0)
  return {
    count: records.length,
    total,
  }
}

export const getColaboradoresAnalytics = async (filters: any) => {
  return pb.collection('colaboradores').getFullList({
    filter: buildFilterStr(filters),
    sort: '-data,-created',
  })
}

export const getColaboradorByRegistro = async (registro: string) => {
  if (!registro || registro.trim() === '') {
    throw new Error('Informe o numero de registro')
  }

  if (!/^\d+$/.test(registro)) {
    throw new Error('Numero de registro invalido')
  }

  const now = Date.now()
  const cached = colabCache.get(registro)

  // Disable cache to ensure validity check is always fresh, especially for manual releases.
  // if (cached && now - cached.timestamp < CACHE_TTL) {
  //   return cached.data
  // }

  const anyColab = await pb
    .collection('colaboradores')
    .getFirstListItem(`registro="${registro}"`)
    .catch(() => null)

  if (!anyColab) {
    throw new Error('não há valor para o colaborador receber')
  }

  const maxRefRecord = await pb
    .collection('colaboradores')
    .getFirstListItem('referencia > 0', { sort: '-referencia', fields: 'referencia' })
    .catch(() => ({ referencia: 0 }))
  const maxRef = maxRefRecord.referencia || 0

  const fotoRecord = await pb
    .collection('fotos_colaboradores')
    .getFirstListItem(`registro="${registro}"`)
    .catch(() => null)

  let fotoUrl = null
  if (fotoRecord) {
    if (fotoRecord.foto_url) {
      fotoUrl = fotoRecord.foto_url
    } else if (fotoRecord.foto) {
      fotoUrl = pb.files.getURL(fotoRecord, fotoRecord.foto)
    }
  }

  if (!fotoRecord || !fotoUrl) {
    throw new Error(
      'Foto não encontrada para o reconhecimento facial. Vá até o guichê para realizar o seu cadastro.',
    )
  }

  const allRecords = await pb
    .collection('colaboradores')
    .getFullList({
      filter: `registro="${registro}"`,
      sort: '-created',
    })
    .catch(() => [])

  if (allRecords.length === 0) {
    throw new Error('não há valor para o colaborador receber')
  }

  const pagamentos = await pb
    .collection('pagamentos')
    .getFullList({
      filter: `registro="${registro}"`,
      fields: 'colaborador_id,status',
      sort: 'created',
    })
    .catch(() => [])

  const pagamentoStatusByColabId = new Map<string, string>()
  for (const p of pagamentos) {
    pagamentoStatusByColabId.set(p.colaborador_id, p.status)
  }

  const mappedRecords = allRecords.map((r) => {
    const pagStatus = pagamentoStatusByColabId.get(r.id)
    const isConfirmedViaPhoto = !!r.foto_confirmacao_url

    let isPendente = false
    let isAgendado = false
    if (pagStatus) {
      isPendente = pagStatus === 'Pendente'
      isAgendado = pagStatus === 'Agendado'
    } else {
      isPendente = !isConfirmedViaPhoto
    }

    const ref = r.referencia || 0
    let isLocked = false
    if (r.data_liberacao) {
      isLocked = new Date(r.data_liberacao) > new Date()
    }

    let isEligible = isPendente
    if (isEligible) {
      if (ref > 0 && maxRef > 0 && ref < maxRef - 3) {
        if (!r.liberado_pagamento) isEligible = false
      }
      if (isLocked) {
        isEligible = false
      }
    }

    return {
      ...r,
      isEligible,
      isAgendado: isLocked || isAgendado,
    }
  })

  const eligibleRecords = mappedRecords.filter((r) => r.isEligible)
  if (eligibleRecords.length === 0) {
    throw new Error('não há valor para o colaborador receber')
  }

  const firstColab = mappedRecords[0]

  const totalValor = mappedRecords.reduce((acc, curr) => {
    if (!curr.isEligible) return acc
    const v = curr.valor_a_receber || curr.valor || 0
    return acc + v
  }, 0)

  const colab = {
    ...firstColab,
    valor_a_receber: totalValor,
    valor: totalValor,
    all_records_ids: mappedRecords.map((r) => r.id),
    records: mappedRecords,
  }

  const result = { colab, fotoUrl, hasFotoRecord: true }
  colabCache.set(registro, { data: result, timestamp: now })

  return result
}
