import pb from '@/lib/pocketbase/client'

export interface DetalhadaItem {
  competencia: string
  valor_calculado: number
}

export interface ExportDetalhadaData {
  items: DetalhadaItem[]
  total: number
  registro: string
  nome: string
}

export interface ExportDetalhadaResult {
  success: boolean
  data?: ExportDetalhadaData
  message?: string
}

export async function exportFolhaDetalhada(
  registro: string,
  dataInicio: string,
  dataFinal: string,
): Promise<ExportDetalhadaResult> {
  try {
    const params = new URLSearchParams({ registro, dataInicio, dataFinal })
    const result = await pb.send(`/backend/v1/export-folha-detalhada?${params.toString()}`, {
      method: 'GET',
    })

    return {
      success: true,
      data: {
        items: result.items || [],
        total: result.total || 0,
        registro: result.registro || registro,
        nome: result.nome || '',
      },
    }
  } catch (error: any) {
    const status = error?.status || 0
    let message: string

    if (status === 0) {
      message = 'Não foi possível conectar com o servidor.'
    } else if (status === 404) {
      message = error?.message || 'Nenhum registro para os critérios informados.'
    } else if (status === 403) {
      message = 'Acesso negado. Apenas administradores podem exportar relatórios detalhados.'
    } else if (status >= 500) {
      message = 'Erro no servidor. Tente novamente ou contate o suporte.'
    } else {
      message = error?.message || 'Erro ao exportar relatório detalhado.'
    }

    return { success: false, message }
  }
}
