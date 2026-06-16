onRecordCreateRequest((e) => {
  const body = e.requestInfo().body || {}
  const colabId = body.colaborador_id || e.record.getString('colaborador_id')
  const status = body.status || e.record.getString('status')

  if (colabId && status === 'Confirmado') {
    try {
      const colab = $app.findRecordById('colaboradores', colabId)
      const dataLib = colab.getString('data_liberacao')
      if (dataLib) {
        const lockDateParts = dataLib.split(' ')[0].split('-')
        if (lockDateParts.length === 3) {
          const lockYear = lockDateParts[0].length === 4 ? lockDateParts[0] : lockDateParts[2]
          const lockMonth = lockDateParts[1]
          const lockDay = lockDateParts[0].length === 4 ? lockDateParts[2] : lockDateParts[0]

          const releaseDay = new Date(Number(lockYear), Number(lockMonth) - 1, Number(lockDay))
          const today = new Date()
          today.setHours(0, 0, 0, 0)

          if (releaseDay > today) {
            throw new BadRequestError('Este pagamento está agendado e ainda não foi liberado.')
          }
        }
      }
    } catch (err) {
      if (err instanceof BadRequestError) throw err
    }
  }

  e.next()
}, 'pagamentos')

onRecordUpdateRequest((e) => {
  const body = e.requestInfo().body || {}
  const colabId = e.record.getString('colaborador_id')
  const status = body.status || e.record.getString('status')

  if (colabId && status === 'Confirmado') {
    try {
      const colab = $app.findRecordById('colaboradores', colabId)
      const dataLib = colab.getString('data_liberacao')
      if (dataLib) {
        const lockDateParts = dataLib.split(' ')[0].split('-')
        if (lockDateParts.length === 3) {
          const lockYear = lockDateParts[0].length === 4 ? lockDateParts[0] : lockDateParts[2]
          const lockMonth = lockDateParts[1]
          const lockDay = lockDateParts[0].length === 4 ? lockDateParts[2] : lockDateParts[0]

          const releaseDay = new Date(Number(lockYear), Number(lockMonth) - 1, Number(lockDay))
          const today = new Date()
          today.setHours(0, 0, 0, 0)

          if (releaseDay > today) {
            throw new BadRequestError('Este pagamento está agendado e ainda não foi liberado.')
          }
        }
      }
    } catch (err) {
      if (err instanceof BadRequestError) throw err
    }
  }

  e.next()
}, 'pagamentos')

onRecordUpdateRequest((e) => {
  const body = e.requestInfo().body || {}

  if (body.liberado_pagamento === true || body.liberado_pagamento === 'true') {
    const dataLib = e.record.getString('data_liberacao')
    if (dataLib) {
      const lockDateParts = dataLib.split(' ')[0].split('-')
      if (lockDateParts.length === 3) {
        const lockYear = lockDateParts[0].length === 4 ? lockDateParts[0] : lockDateParts[2]
        const lockMonth = lockDateParts[1]
        const lockDay = lockDateParts[0].length === 4 ? lockDateParts[2] : lockDateParts[0]

        const releaseDay = new Date(Number(lockYear), Number(lockMonth) - 1, Number(lockDay))
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        if (releaseDay > today) {
          throw new BadRequestError('Não é possível liberar um pagamento agendado para o futuro.')
        }
      }
    }
  }

  e.next()
}, 'colaboradores')
