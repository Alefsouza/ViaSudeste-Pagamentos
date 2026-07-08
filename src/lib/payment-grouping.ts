import { getTipoPagamentoAbrev, checkIsLocked } from '@/lib/formatters'

function getEffectiveFotoUrl(record: any): string | null {
  return record.pagamento_relacionado?.foto_confirmacao_url || record.foto_confirmacao_url || null
}

function getActualValue(curr: any): number {
  if (curr.pagamento_relacionado?.status === 'Confirmado') {
    return curr.pagamento_relacionado.valor_pago || 0
  }
  return curr.valor_a_receber || curr.valor || 0
}

function evaluateStatus(curr: any, maxRef: number): string {
  if (curr.pagamento_relacionado?.status === 'Cancelado') return 'Cancelado'
  if (curr.pagamento_relacionado?.status === 'Confirmado') return 'Confirmado'
  let status = curr.foto_confirmacao_url ? 'Confirmado' : 'Pendente'
  const liberadoPagamento = curr.liberado_pagamento
  const dataLiberacao = curr.data_liberacao
  const ref = curr.referencia || 0
  if (status === 'Pendente') {
    const isLocked = checkIsLocked(dataLiberacao)
    const isOutsideWindow = ref > 0 && maxRef > 0 && ref < maxRef - 3
    if (isLocked) status = 'Agendado'
    else if (isOutsideWindow && !liberadoPagamento) status = 'Bloqueado'
  }
  return status
}

const GROUPABLE_STATUSES = new Set(['Pendente', 'Bloqueado', 'Agendado'])

export function groupPaymentsByPhoto(records: any[], maxRef: number = 0): any[] {
  const groups = new Map<string, any[]>()

  for (const record of records) {
    const fotoUrl = getEffectiveFotoUrl(record)

    let key: string
    if (fotoUrl) {
      key = fotoUrl
    } else {
      const status = evaluateStatus(record, maxRef)
      if (GROUPABLE_STATUSES.has(status)) {
        const registro = record.registro || 'unknown'
        const referencia = record.referencia ?? 'null'
        key = `sem_foto_${registro}_${referencia}`
      } else {
        key = `unique_${record.id}`
      }
    }

    if (!groups.has(key)) {
      groups.set(key, [])
    }
    groups.get(key)!.push(record)
  }

  const result: any[] = []

  for (const [key, groupRecords] of groups) {
    if (groupRecords.length === 1) {
      result.push(groupRecords[0])
      continue
    }

    const isPhotoGroup = !key.startsWith('sem_foto_') && !key.startsWith('unique_')
    const fotoUrl = isPhotoGroup ? key : null

    const totalValor = groupRecords.reduce((sum, r) => sum + getActualValue(r), 0)

    const nomes = [...new Set(groupRecords.map((r) => r.nome).filter(Boolean))]
    const registros = [...new Set(groupRecords.map((r) => r.registro).filter(Boolean))]
    const filiais = [
      ...new Set(
        groupRecords
          .map((r) => {
            if (r.filial === 2) return 'Cursino'
            if (r.filial === 4) return 'Sapopemba'
            return r.filial ? String(r.filial) : null
          })
          .filter(Boolean),
      ),
    ]
    const referencias = [
      ...new Set(groupRecords.map((r) => r.referencia).filter((r) => r != null)),
    ] as number[]

    const tiposSet = new Set<string>()
    groupRecords.forEach((r) => {
      const tipo = getTipoPagamentoAbrev(r.idtipopgto)
      if (tipo) tiposSet.add(tipo)
    })
    const tipos_pagamento = Array.from(tiposSet)

    let latestUpdated = ''
    let dataPagamento = ''
    let horaPagamento = ''
    let earliestCreated = ''

    for (const r of groupRecords) {
      const pag = r.pagamento_relacionado
      const updated = pag?.updated || r.updated || ''
      if (updated > latestUpdated) latestUpdated = updated

      const dp = pag?.data_pagamento || r.data_pagamento || ''
      if (dp && (!dataPagamento || dp > dataPagamento)) dataPagamento = dp

      const hp = pag?.hora_pagamento || r.hora_pagamento || ''
      if (hp && (!horaPagamento || hp > horaPagamento)) horaPagamento = hp

      const created = r.created || ''
      if (!earliestCreated || created < earliestCreated) earliestCreated = created
    }

    const pagamentoRelacionado = isPhotoGroup
      ? {
          status: 'Confirmado',
          valor_pago: totalValor,
          foto_confirmacao_url: fotoUrl,
          data_pagamento: dataPagamento,
          hora_pagamento: horaPagamento,
          updated: latestUpdated,
        }
      : null

    result.push({
      id: key,
      _isGrouped: true,
      _groupCount: groupRecords.length,
      _records: groupRecords,
      foto_confirmacao_url: fotoUrl,
      nomes,
      registros,
      filiais,
      referencias,
      tipos_pagamento,
      nome: nomes.length === 1 ? nomes[0] : nomes.join(', '),
      registro: registros.length === 1 ? registros[0] : registros.join(', '),
      filial: groupRecords[0].filial,
      referencia: referencias[0] ?? groupRecords[0].referencia ?? null,
      valor_a_receber: totalValor,
      valor: totalValor,
      data_pagamento: dataPagamento,
      hora_pagamento: horaPagamento,
      created: earliestCreated,
      updated: latestUpdated,
      liberado_pagamento: groupRecords.every((r) => r.liberado_pagamento),
      data_liberacao: groupRecords[0].data_liberacao,
      periodo_inicio: groupRecords[0].periodo_inicio,
      periodo_fim: groupRecords[0].periodo_fim,
      idtipopgto: groupRecords[0].idtipopgto,
      pagamento_relacionado: pagamentoRelacionado,
    })
  }

  return result
}
