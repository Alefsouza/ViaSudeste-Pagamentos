import pb from '@/lib/pocketbase/client'

export async function exportFolha(competencia: string): Promise<string> {
  const url = pb.buildUrl('/backend/v1/export-folha?competencia=' + encodeURIComponent(competencia))

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: pb.authStore.token,
    },
  })

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('Nenhum registro encontrado para esta competência')
    }
    if (res.status >= 500) {
      throw new Error(
        'Não foi possível comunicar com o servidor externo ou ocorreu um erro interno',
      )
    }

    let message = 'Ocorreu um erro ao exportar a folha.'
    try {
      const data = await res.json()
      if (data.message) {
        message = data.message
      }
    } catch (e) {
      // Falha ao parsear JSON, mantemos a mensagem genérica
    }
    throw new Error(message)
  }

  return res.text()
}
