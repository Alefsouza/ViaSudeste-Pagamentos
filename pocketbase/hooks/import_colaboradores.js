routerAdd(
  'POST',
  '/backend/v1/import/colaboradores',
  (e) => {
    const body = e.requestInfo().body
    if (!body || !body.data || !Array.isArray(body.data)) {
      return e.badRequestError('Payload inválido')
    }

    let count = 0
    const errors = []

    $app.runInTransaction((txApp) => {
      const col = txApp.findCollectionByNameOrId('colaboradores')

      for (const item of body.data) {
        // Permanently block re-import of Reference 15 data
        if (item.referencia !== undefined && Number(item.referencia) === 15) {
          errors.push(
            `Registro ignorado (Referência 15 bloqueada permanentemente): ${item.registro || 'desconhecido'}`,
          )
          continue
        }

        try {
          const record = new Record(col)

          for (const [key, value] of Object.entries(item)) {
            if (value !== undefined && value !== '') {
              let finalValue = value
              if (
                ['data_liberacao', 'data_pagamento_v2', 'periodo_inicio', 'periodo_fim'].includes(
                  key,
                )
              ) {
                if (typeof finalValue === 'string') {
                  const d = new Date(finalValue)
                  if (isNaN(d.getTime())) {
                    throw new Error(`Data inválida no campo ${key}: ${finalValue}`)
                  }
                  finalValue = d.toISOString().replace('T', ' ')
                }
              } else if (key === 'horas') {
                finalValue = String(finalValue)
              }
              record.set(key, finalValue)
            }
          }

          if (!item.referencia && body.referencia !== undefined) {
            const bodyRef = Number(body.referencia)
            if (bodyRef === 15) {
              throw new Error('Importação da Referência 15 está bloqueada permanentemente.')
            }
            record.set('referencia', body.referencia)
          }

          if (item.liberado_pagamento === undefined) {
            record.set('liberado_pagamento', true)
          }

          txApp.save(record)
          count++
        } catch (err) {
          errors.push(
            `Erro na linha (Registro: ${item.registro || 'desconhecido'}): ${err.message}`,
          )
        }
      }

      try {
        txApp
          .db()
          .newQuery(`
          UPDATE colaboradores
          SET liberado_pagamento = 1
          WHERE referencia IN (
            SELECT DISTINCT referencia
            FROM colaboradores
            WHERE referencia IS NOT NULL AND referencia != 15
            ORDER BY referencia DESC
            LIMIT 4
          ) AND liberado_pagamento = 0
        `)
          .execute()

        txApp
          .db()
          .newQuery(`
          UPDATE colaboradores
          SET liberado_pagamento = 0
          WHERE (
            referencia IS NULL
            OR referencia = 15
            OR referencia NOT IN (
              SELECT DISTINCT referencia
              FROM colaboradores
              WHERE referencia IS NOT NULL AND referencia != 15
              ORDER BY referencia DESC
              LIMIT 4
            )
          ) AND liberado_pagamento = 1
        `)
          .execute()
      } catch (err) {
        console.log('Erro na limpeza de referencias antigas:', err.message)
      }
    })

    return e.json(200, { count, errors })
  },
  $apis.requireAuth(),
)
