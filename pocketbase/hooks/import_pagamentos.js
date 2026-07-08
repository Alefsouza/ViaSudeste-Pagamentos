routerAdd(
  'POST',
  '/backend/v1/import/pagamentos',
  (e) => {
    const body = e.requestInfo().body
    if (!body || !body.data || !Array.isArray(body.data)) {
      return e.badRequestError('Payload inválido')
    }

    let count = 0
    const errors = []

    $app.runInTransaction((txApp) => {
      const col = txApp.findCollectionByNameOrId('pagamentos')

      for (const item of body.data) {
        try {
          const record = new Record(col)

          for (const [key, value] of Object.entries(item)) {
            if (value !== undefined && value !== '') {
              let finalValue = value
              if (['data_pagamento', 'data_pagamento_v2'].includes(key)) {
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
            record.set('referencia', body.referencia)
          }

          txApp.save(record)
          count++
        } catch (err) {
          errors.push(
            `Erro na linha (Registro: ${item.registro || 'desconhecido'}): ${err.message}`,
          )
        }
      }
    })

    return e.json(200, { count, errors })
  },
  $apis.requireAuth(),
)
