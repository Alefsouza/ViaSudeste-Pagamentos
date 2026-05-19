import pb from '@/lib/pocketbase/client'

export const getColaboradores = () => pb.collection('colaboradores').getFullList({ sort: 'nome' })

export const updateColaborador = (id: string, data: Partial<{ foto_confirmacao_url: string }>) =>
  pb.collection('colaboradores').update(id, data)

const colabCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export const getColaboradoresPaginated = async (page: number, perPage: number, filters: any) => {
  const { search, startDate, endDate, filial } = filters
  let filterStr = []

  if (search) {
    filterStr.push(`(nome~"${search}" || registro~"${search}")`)
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

  const finalFilter = filterStr.join(' && ')

  return pb.collection('colaboradores').getList(page, perPage, {
    filter: finalFilter,
    sort: '-created',
  })
}

export const getColaboradoresStats = async (filters: any) => {
  const { search, startDate, endDate, filial } = filters
  let filterStr = []

  if (search) {
    filterStr.push(`(nome~"${search}" || registro~"${search}")`)
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

  const finalFilter = filterStr.join(' && ')

  const records = await pb.collection('colaboradores').getFullList({
    filter: finalFilter,
    fields: 'valor_a_receber,valor',
  })

  const total = records.reduce((acc, curr) => acc + (curr.valor_a_receber || curr.valor || 0), 0)
  return {
    count: records.length,
    total,
  }
}

export const getColaboradoresAnalytics = async (filters: any) => {
  const { search, startDate, endDate, filial } = filters
  let filterStr = []

  if (search) {
    filterStr.push(`(nome~"${search}" || registro~"${search}")`)
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

  const finalFilter = filterStr.join(' && ')

  return pb.collection('colaboradores').getFullList({
    filter: finalFilter,
    sort: '-created',
  })
}

export const getColaboradorByRegistro = async (registro: string) => {
  const now = Date.now()
  const cached = colabCache.get(registro)

  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.data
  }

  const firstColab = await pb
    .collection('colaboradores')
    .getFirstListItem(`registro="${registro}" && foto_confirmacao_url=""`)
    .catch(() => null)

  let colab = null
  if (firstColab) {
    const allRecords = await pb
      .collection('colaboradores')
      .getFullList({
        filter: `nome="${firstColab.nome}" && foto_confirmacao_url=""`,
        sort: '-data',
      })
      .catch(() => [firstColab])

    const totalValor = allRecords.reduce((acc, curr) => {
      const v = curr.valor_a_receber || curr.valor || 0
      return acc + v
    }, 0)

    colab = {
      ...firstColab,
      valor_a_receber: totalValor,
      valor: totalValor,
      all_records_ids: allRecords.map((r) => r.id),
      records: allRecords,
    }
  }

  const fotoRecord = await pb
    .collection('fotos_colaboradores')
    .getFirstListItem(`registro="${registro}"`)
    .catch((error) => {
      console.error('Erro ao buscar foto do colaborador:', error)
      return null
    })

  let fotoUrl = null
  if (fotoRecord) {
    if (fotoRecord.foto_url) {
      fotoUrl = fotoRecord.foto_url
    } else if (fotoRecord.foto) {
      fotoUrl = pb.files.getURL(fotoRecord, fotoRecord.foto)
    }
  }

  const result = { colab, fotoUrl, hasFotoRecord: !!fotoRecord }
  colabCache.set(registro, { data: result, timestamp: now })

  return result
}
