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
    let errors = []

    const col = $app.findCollectionByNameOrId('colaboradores')

    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      const getVal = (key) => {
        const found = Object.keys(row).find((k) => k.toUpperCase().trim() === key)
        return found ? row[found] : ''
      }

      const registroRaw = String(getVal('REGISTRO')).trim()
      if (!registroRaw) continue

      const registro = Number(registroRaw).toString()
      const nome = String(getVal('NOME')).trim() || ''

      let valorStr = String(getVal('VALOR')).replace(',', '.')
      let valor = parseFloat(valorStr)
      if (isNaN(valor)) valor = 0

      const filialRaw = String(getVal('FILIAL')).trim()
      let filialName = ''
      if (filialRaw === '2') filialName = 'Sapopemba'
      else if (filialRaw === '3' || filialRaw === '4') filialName = 'Cursino'
      else continue

      const record = new Record(col)
      record.set('registro', registro)
      record.set('nome', nome)
      record.set('valor_a_receber', valor)
      record.set('filial', filialName)
      record.set('foto_confirmacao_url', '')

      try {
        $app.save(record)
        count++
      } catch (err) {
        errors.push(`Erro ao importar linha ${i + 2}: ${err.message}`)
      }
    }

    if (errors.length > 0 && count === 0) {
      return e.badRequestError(errors.join('\n'))
    }

    return e.json(200, {
      message: `${count} colaboradores importados com sucesso`,
      count,
      errors,
    })
  },
  $apis.requireAuth(),
)
