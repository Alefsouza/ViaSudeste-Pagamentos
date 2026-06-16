routerAdd(
  'POST',
  '/backend/v1/import/colaboradores',
  (e) => {
    const body = e.requestInfo().body || {}
    if (!body.data || !Array.isArray(body.data)) {
      return e.badRequestError('Invalid payload, missing data array.')
    }

    const metadata = body.metadata || {}
    const customRef = metadata.referencia
    const data_liberacao = metadata.data_liberacao || ''
    const periodo_inicio = metadata.periodo_inicio || ''
    const periodo_fim = metadata.periodo_fim || ''

    const col = $app.findCollectionByNameOrId('colaboradores')
    let count = 0
    let errors = []

    let nextRef = 1
    if (customRef !== undefined && customRef !== null && customRef !== '') {
      nextRef = Number(customRef)
    } else {
      try {
        const records = $app.findRecordsByFilter(
          'colaboradores',
          'referencia > 0',
          '-referencia',
          1,
          0,
        )
        if (records && records.length > 0) {
          nextRef = records[0].getInt('referencia') + 1
        }
      } catch (_) {
        // Ignora erro se não houver registros
      }
    }

    $app.runInTransaction((txApp) => {
      for (let i = 0; i < body.data.length; i++) {
        const row = body.data[i]
        try {
          // Every row must always create a NEW record
          const record = new Record(col)

          const registro = row.registro || row.REGISTRO || ''
          const nome = row.nome || row.NOME || ''
          const dataStr = row.data || row.DATA || ''
          const dataPagamentoV2 = row.data_pagamento_v2 || ''
          const idtipopgto =
            Number(row.idtipopgto !== undefined ? row.idtipopgto : row.IDTIPOPGTO) || 0
          const inicio = row.inicio || row.INICIO || ''
          const termino = row.termino || row.TERMINO || ''
          const horas = String(row.horas || row.HORAS || '')
          const valor =
            Number(
              row.valor_a_receber !== undefined
                ? row.valor_a_receber
                : row.valor !== undefined
                  ? row.valor
                  : row.VALOR !== undefined
                    ? row.VALOR
                    : 0,
            ) || 0
          const filial = row.filial || ''
          const filial_id =
            row.filial_id !== undefined ? row.filial_id : row.FILIAL !== undefined ? row.FILIAL : ''

          record.set('referencia', nextRef)
          record.set('liberado_pagamento', false)

          if (data_liberacao) record.set('data_liberacao', data_liberacao)
          if (periodo_inicio) record.set('periodo_inicio', periodo_inicio)
          if (periodo_fim) record.set('periodo_fim', periodo_fim)

          record.set('registro', registro)
          record.set('nome', nome)
          record.set('data', dataStr)

          if (dataPagamentoV2) {
            record.set('data_pagamento_v2', dataPagamentoV2)
          } else if (dataStr) {
            const parts = dataStr.split('/')
            if (parts.length === 3) {
              record.set('data_pagamento_v2', `${parts[2]}-${parts[1]}-${parts[0]} 12:00:00.000Z`)
            }
          }

          record.set('idtipopgto', idtipopgto)
          record.set('inicio', inicio)
          record.set('termino', termino)
          record.set('horas', horas)
          record.set('valor_a_receber', valor)
          record.set('valor', valor)
          if (filial) {
            record.set('filial', filial)
          }

          const filialNum = Number(filial_id)
          if (!isNaN(filialNum) && String(filial_id).trim() !== '') {
            record.set('filial_id', filialNum)
            if (!filial) {
              if (filialNum === 2) record.set('filial', 'Sapopemba')
              else if (filialNum === 3 || filialNum === 4) record.set('filial', 'Cursino')
            }
          }

          txApp.save(record)
          count++
        } catch (err) {
          errors.push(`Row ${i + 1} error: ${err.message}`)
        }
      }
    })

    return e.json(200, { count, errors })
  },
  $apis.requireAuth(),
)
