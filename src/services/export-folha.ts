import pb from '@/lib/pocketbase/client'

export type ExportFolhaResult =
  | { success: true; blob: Blob; filename: string; message?: never }
  | { success: false; status: number; message: string; blob?: never; filename?: never }

/**
 * Formata uma linha do arquivo TXT da folha de pagamento:
 * 1. Número do registro com zeros à esquerda até 6 dígitos (ex: 6853 -> 006853)
 * 2. Tabulação (\t)
 * 3. Código fixo 360
 * 4. Tabulação (\t)
 * 5. Valor com zeros à esquerda até 14 posições, com vírgula decimal (ex: 000000000263,32)
 */
export function formatFolhaTxtLine(registro: string | number, valor: number | string): string {
  const cleanReg = String(registro ?? '')
    .replace(/^0+(?!$)/, '')
    .trim()
  const regPadded = cleanReg.padStart(6, '0')

  const numVal =
    typeof valor === 'number' ? valor : parseFloat(String(valor).replace(',', '.')) || 0
  const valDecimalStr = numVal.toFixed(2).replace('.', ',')
  const valPadded = valDecimalStr.padStart(14, '0')

  return `${regPadded}\t360\t${valPadded}`
}

export async function exportFolha(
  competencia: string,
  garagem?: string,
): Promise<ExportFolhaResult> {
  try {
    const params = new URLSearchParams({ competencia })
    if (garagem && garagem !== 'ambas' && garagem !== 'Ambas Garagens') {
      params.append('garagem', garagem)
    }

    const response = await fetch(`${pb.baseURL}/backend/v1/export-folha?${params.toString()}`, {
      method: 'GET',
      headers: {
        Authorization: pb.authStore.token,
      },
    })

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
      const match = contentDisposition.match(/filename="?([^";]+)"?/)
      if (match && match[1]) {
        filename = match[1].trim()
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
