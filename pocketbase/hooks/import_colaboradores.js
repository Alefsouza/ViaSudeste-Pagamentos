routerAdd(
  'POST',
  '/backend/v1/import/colaboradores',
  (e) => {
    const body = e.requestInfo().body
    if (!body || !body.data || !Array.isArray(body.data)) {
      return e.badRequestError('Invalid payload')
    }

    const data = body.data
    let count = 0
    const errors = []

    $app.runInTransaction((txApp) => {
      const colabCollection = txApp.findCollectionByNameOrId('colaboradores')

      for (let i = 0; i < data.length; i++) {
        const row = data[i]
        try {
          const record = new Record(colabCollection)

          record.set('registro', String(row['REGISTRO'] || ''))
          record.set('nome', String(row['NOME'] || ''))
          record.set('data', String(row['DATA'] || ''))
          record.set('idtipopgto', Number(row['IDTIPOPGTO']) || 0)
          record.set('inicio', String(row['INICIO'] || ''))
          record.set('termino', String(row['TERMINO'] || ''))
          record.set('horas', String(row['HORAS'] || ''))
          record.set('valor_a_receber', Number(row['VALOR']) || 0)

          const filialVal = row['FILIAL']
          if (filialVal === 'Cursino' || filialVal === 'Sapopemba') {
            record.set('filial', filialVal)
          } else if (
            filialVal !== undefined &&
            filialVal !== null &&
            String(filialVal).trim() !== ''
          ) {
            record.set('filial_id', Number(filialVal) || 0)
          }

          txApp.save(record)
          count++
        } catch (err) {
          errors.push(`Row ${i + 1}: ${err.message}`)
        }
      }
    })

    return e.json(200, { count, errors })
  },
  $apis.requireAuth(),
)
