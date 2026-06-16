onRecordValidate((e) => {
  const hasUrl = !!e.record.getString('foto_confirmacao_url')
  const hasFile =
    e.record.getString('foto_confirmacao') !== '' ||
    e.findUploadedFiles('foto_confirmacao').length > 0

  if (hasUrl || hasFile) {
    const colabId = e.record.getString('colaborador_id')
    let dataLib = ''
    let dataPagV2 = ''
    if (colabId) {
      try {
        const colab = $app.findRecordById('colaboradores', colabId)
        dataLib = colab.getString('data_liberacao')
        dataPagV2 = colab.getString('data_pagamento_v2')
      } catch (_) {}
    }
    const dataPag = e.record.getString('data_pagamento')

    const datesToCheck = [dataLib, dataPagV2, dataPag].filter(Boolean)
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    for (const dStr of datesToCheck) {
      const parts = dStr.split(' ')[0].split('-')
      if (parts.length === 3) {
        const y = parts[0].length === 4 ? parts[0] : parts[2]
        const m = parts[1]
        const d = parts[0].length === 4 ? parts[2] : parts[0]
        const dateObj = new Date(Number(y), Number(m) - 1, Number(d))

        if (dateObj > startOfToday) {
          throw new BadRequestError(
            'Não é possível confirmar ou anexar foto a um pagamento agendado antes da data prevista.',
          )
        }
      }
    }
  }

  if (e.record.getString('status') === 'Confirmado') {
    if (!hasUrl && !hasFile) {
      throw new BadRequestError('Não é possível confirmar o pagamento sem uma foto de comprovação.')
    }
  } else {
    if (hasUrl || hasFile) {
      e.record.set('status', 'Confirmado')
    } else {
      const currentStatus = e.record.getString('status')
      if (currentStatus !== 'Cancelado') {
        e.record.set('status', 'Pendente')
      }
    }
  }
  e.next()
}, 'pagamentos')
