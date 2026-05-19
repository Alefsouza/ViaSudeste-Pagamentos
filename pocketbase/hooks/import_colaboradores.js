routerAdd(
  'POST',
  '/backend/v1/import/colaboradores',
  (e) => {
    const body = e.requestInfo().body || {}
    if (!body.data || !Array.isArray(body.data)) {
      return e.badRequestError('Invalid payload, missing data array.')
    }

    const col = $app.findCollectionByNameOrId('colaboradores')
    let count = 0
    let errors = []

    $app.runInTransaction((txApp) => {
      for (let i = 0; i < body.data.length; i++) {
        const row = body.data[i]
        try {
          // Every row must always create a NEW record
          const record = new Record(col)

          const registro = row.registro || row.REGISTRO || ''
          const nome = row.nome || row.NOME || ''
          const dataStr = row.data || row.DATA || ''
          const idtipopgto =
            Number(row.idtipopgto !== undefined ? row.idtipopgto : row.IDTIPOPGTO) || 0
          const inicio = row.inicio || row.INICIO || ''
          const termino = row.termino || row.TERMINO || ''
          const horas = String(row.horas || row.HORAS || '')
          const valor =
            Number(
              row.valor_a_receber !== undefined
                ? row.valor_a_receber
                : row.VALOR !== undefined
                  ? row.VALOR
                  : 0,
            ) || 0
          const filial =
            row.filial !== undefined ? row.filial : row.FILIAL !== undefined ? row.FILIAL : ''

          record.set('registro', registro)
          record.set('nome', nome)
          record.set('data', dataStr)
          record.set('idtipopgto', idtipopgto)
          record.set('inicio', inicio)
          record.set('termino', termino)
          record.set('horas', horas)
          record.set('valor_a_receber', valor)

          const filialNum = Number(filial)
          if (!isNaN(filialNum) && String(filial).trim() !== '') {
            record.set('filial_id', filialNum)
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
