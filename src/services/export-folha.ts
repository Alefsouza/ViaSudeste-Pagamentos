import pb from '@/lib/pocketbase/client'

export type ExportFolhaResult =
  | { success: true; blob: Blob; filename: string }
  | { success: false; status: number; message: string }

export async function exportFolha(competencia: string): Promise<ExportFolhaResult> {
  try {
    const response = await fetch(
      `${pb.baseURL}/backend/v1/export-folha?competencia=${encodeURIComponent(competencia)}`,
      {
        method: 'GET',
        headers: {
          Authorization: pb.authStore.token,
        },
      },
    )

    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: false,
          status: 404,
          message: 'Nenhum registro encontrado para esta competência.',
        }
      }
      return {
        success: false,
        status: response.status,
        message: 'Erro ao exportar folha. Verifique os dados ou contate o suporte.',
      }
    }

    const blob = await response.blob()
    const contentDisposition = response.headers.get('Content-Disposition')
    let filename = ''

    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^"]+)"?/)
      if (match && match[1]) {
        filename = match[1]
      }
    }

    return { success: true, blob, filename }
  } catch (error: any) {
    return {
      success: false,
      status: 0,
      message: error.message || 'Erro inesperado ao conectar com o servidor.',
    }
  }
}
