import pb from '@/lib/pocketbase/client'

export const getColaboradores = () => pb.collection('colaboradores').getFullList({ sort: 'nome' })

export const getColaboradorByRegistro = async (registro: string) => {
  const colab = await pb.collection('colaboradores').getFirstListItem(`registro="${registro}"`)

  let fotoUrl = null
  try {
    const fotoRecord = await pb
      .collection('fotos_colaboradores')
      .getFirstListItem(`registro="${registro}"`)
    fotoUrl = pb.files.getURL(fotoRecord, fotoRecord.foto)
  } catch (_) {
    // Foto não encontrada
  }

  return { ...colab, fotoUrl }
}
