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
  const result = await pb.collection('colaboradores').getList(page, perPage, {
    filter: buildFilterStr(filters),
    sort: '-data,-created',
  })

  if (result.items.length > 0) {
    const colabIds = result.items.map((i: any) => i.id)
    const pagamentos = await pb
      .collection('pagamentos')
      .getFullList({
        filter: colabIds.map((id: string) => `colaborador_id="${id}"`).join(' || '),
        sort: 'created',
      })
      .catch(() => [])

    const pagMap = new Map()
    for (const p of pagamentos) {
      pagMap.set(p.colaborador_id, p)
    }

    result.items = result.items.map((item: any) => {
      const pag = pagMap.get(item.id)
      if (pag) {
        return { ...item, pagStatus: pag.status }
      }
      return item
    })
  }

  return result
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
  const records = await pb.collection('colaboradores').getFullList({
    filter: buildFilterStr(filters),
    sort: '-data,-created',
  })

  if (records.length > 0) {
    const pagamentos = await pb
      .collection('pagamentos')
      .getFullList({
        fields: 'colaborador_id,status',
        sort: 'created',
      })
      .catch(() => [])

    const pagMap = new Map()
    for (const p of pagamentos) {
      pagMap.set(p.colaborador_id, p.status)
    }

    return records.map((r: any) => ({
      ...r,
      pagStatus: pagMap.get(r.id),
    }))
  }

  return records
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
    throw new Error('Não há valor para o colaborador receber')
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
    throw new Error('Não há valor para o colaborador receber')
  }

  const pagamentos = await pb
    .collection('pagamentos')
    .getFullList({
      filter: `registro="${registro}"`,
      fields: 'id,colaborador_id,status',
      sort: 'created',
    })
    .catch(() => [])

  const pagamentoByColabId = new Map<string, any>()
  for (const p of pagamentos) {
    pagamentoByColabId.set(p.colaborador_id, p)
  }

  const mappedRecords = allRecords.map((r) => {
    const pag = pagamentoByColabId.get(r.id)
    const pagStatus = pag?.status
    const pagId = pag?.id
    const isConfirmedViaPhoto = !!r.foto_confirmacao_url

    let isPendente = false
    let isAgendado = false
    const isExplicitPendente = pagStatus === 'Pendente'

    if (pagStatus) {
      isPendente = pagStatus === 'Pendente'
      isAgendado = pagStatus === 'Agendado'
    } else {
      isPendente = !isConfirmedViaPhoto
    }

    const ref = r.referencia || 0
    let isLocked = false
    if (r.data_liberacao) {
      const dataLiberacaoDate = new Date(r.data_liberacao)
      if (!isNaN(dataLiberacaoDate.getTime())) {
        const agoraUtc3 = new Date(Date.now() - 3 * 3600000)
        const todayStr = `${agoraUtc3.getUTCFullYear()}-${String(agoraUtc3.getUTCMonth() + 1).padStart(2, '0')}-${String(agoraUtc3.getUTCDate()).padStart(2, '0')}`
        const libStr = `${dataLiberacaoDate.getUTCFullYear()}-${String(dataLiberacaoDate.getUTCMonth() + 1).padStart(2, '0')}-${String(dataLiberacaoDate.getUTCDate()).padStart(2, '0')}`
        isLocked = todayStr < libStr
      }
    }

    let isEligible = isPendente
    if (isExplicitPendente) {
      isEligible = true
      isLocked = false
    } else if (isEligible) {
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
      isExplicitPendente,
      pagamento_id: pagId,
      pagStatus,
      isAgendado: isLocked || isAgendado,
    }
  })

  const eligibleRecords = mappedRecords.filter((r) => r.isEligible)
  if (eligibleRecords.length === 0) {
    throw new Error('Não há valor para o colaborador receber')
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
