import pb from '@/lib/pocketbase/client'

export const getColaboradores = () => pb.collection('colaboradores').getFullList({ sort: 'nome' })

export const updateColaborador = (id: string, data: Partial<{ foto_confirmacao_url: string }>) =>
  pb.collection('colaboradores').update(id, data)

const colabCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

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
