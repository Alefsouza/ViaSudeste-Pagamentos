import pb from '@/lib/pocketbase/client'

export const getPagamentos = () =>
  pb.collection('pagamentos').getFullList({ expand: 'colaborador_id', sort: '-created' })
