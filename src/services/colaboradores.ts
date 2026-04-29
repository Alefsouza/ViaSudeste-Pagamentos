import pb from '@/lib/pocketbase/client'

export const getColaboradores = () => pb.collection('colaboradores').getFullList({ sort: 'nome' })
