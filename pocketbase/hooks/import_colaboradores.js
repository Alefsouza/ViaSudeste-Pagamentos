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
        try {
          const record = new Record(col)

          for (const [key, value] of Object.entries(item)) {
            if (value !== undefined && value !== '') {
              record.set(key, value)
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
