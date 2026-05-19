onRecordAfterUpdateSuccess((e) => {
  if (e.record.getString('status') !== 'Confirmado') {
    return e.next()
  }

  if (e.record.original().getString('status') === 'Confirmado') {
    return e.next()
  }

  let nome = e.record.getString('nome')
  if (!nome) {
    const colabId = e.record.getString('colaborador_id')
    if (colabId) {
      try {
        const colab = $app.findRecordById('colaboradores', colabId)
        nome = colab.getString('nome')
      } catch (_) {}
    }
  }

  if (nome) {
    const records = $app.findRecordsByFilter('colaboradores', 'nome = {:nome}', '', 1000, 0, {
      nome: nome,
    })

    const d = new Date()
    const pad = (n) => (n < 10 ? '0' + n : n)
    const formattedDate = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`

    for (let i = 0; i < records.length; i++) {
      const rec = records[i]
      if (!rec.getString('data_pagamento')) {
        rec.set('data_pagamento', formattedDate)
        try {
          $app.saveNoValidate(rec)
        } catch (err) {
          $app
            .logger()
            .error('Erro ao salvar data_pagamento no colaborador (update)', 'error', String(err))
        }
      }
    }
  }

  return e.next()
}, 'pagamentos')
