import pb from '@/lib/pocketbase/client'

export const getColaboradores = () => pb.collection('colaboradores').getFullList({ sort: 'nome' })

export const getColaboradorByRegistro = (registro: string) =>
  pb.collection('colaboradores').getFirstListItem(`registro="${registro}"`)
