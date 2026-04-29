routerAdd(
  'POST',
  '/backend/v1/import/colaboradores',
  (e) => {
    const body = e.requestInfo().body
    if (!body || !body.data || !Array.isArray(body.data)) {
      return e.badRequestError('Nenhum dado enviado.')
    }

    const data = body.data
    let count = 0

    $app.runInTransaction((txApp) => {
      for (const row of data) {
        const getVal = (key) => {
          const found = Object.keys(row).find((k) => k.toUpperCase().trim() === key)
          return found ? row[found] : ''
        }

        const registro = String(getVal('REGISTRO')).trim()
        if (!registro) continue

        const nome = String(getVal('NOME')).trim() || 'Colaborador ' + registro

        let valorStr = String(getVal('VALOR')).replace(',', '.')
        let valor = parseFloat(valorStr)
        if (isNaN(valor)) valor = 0

        const filialRaw = String(getVal('FILIAL')).trim()
        let filialName = ''
        if (filialRaw === '2') filialName = 'Sapopemba'
        else if (filialRaw === '3' || filialRaw === '4') filialName = 'Cursino'
        else continue

        let record
        try {
          record = txApp.findFirstRecordByData('colaboradores', 'registro', registro)
          record.set('nome', nome)
          record.set('valor_a_receber', valor)
          record.set('filial', filialName)
        } catch (_) {
          const col = txApp.findCollectionByNameOrId('colaboradores')
          record = new Record(col)
          record.set('registro', registro)
          record.set('nome', nome)
          record.set('valor_a_receber', valor)
          record.set('filial', filialName)
        }
        txApp.save(record)
        count++
      }
    })

    return e.json(200, { message: `${count} colaboradores importados com sucesso`, count })
  },
  $apis.requireAuth(),
)
