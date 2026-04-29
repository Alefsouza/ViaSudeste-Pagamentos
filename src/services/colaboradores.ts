import pb from '@/lib/pocketbase/client'

export const getColaboradores = () => pb.collection('colaboradores').getFullList({ sort: 'nome' })

export const updateColaborador = (id: string, data: Partial<{ foto_confirmacao_url: string }>) =>
  pb.collection('colaboradores').update(id, data)

export const getColaboradorByRegistro = async (registro: string) => {
  const colabPromise = pb
    .collection('colaboradores')
    .getFirstListItem(`registro="${registro}"`)
    .catch(() => null)

  const fotoPromise = pb
    .collection('fotos_colaboradores')
    .getFirstListItem(`registro="${registro}"`)
    .catch((error) => {
      console.error('Erro ao buscar foto do colaborador:', error)
      return null
    })

  const [colab, fotoRecord] = await Promise.all([colabPromise, fotoPromise])

  let fotoUrl = null
  if (fotoRecord) {
    if (fotoRecord.foto_url) {
      fotoUrl = fotoRecord.foto_url
    } else if (fotoRecord.foto) {
      fotoUrl = pb.files.getURL(fotoRecord, fotoRecord.foto)
    }
  }

  return { colab, fotoUrl, hasFotoRecord: !!fotoRecord }
}
