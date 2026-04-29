import pb from '@/lib/pocketbase/client'

export const getPagamentos = () =>
  pb.collection('pagamentos').getFullList({ expand: 'colaborador_id', sort: '-created' })

export const createPagamento = (data: {
  colaborador_id: string
  valor_pago: number
  data_pagamento: string
  foto_confirmacao?: File
}) => pb.collection('pagamentos').create(data)
