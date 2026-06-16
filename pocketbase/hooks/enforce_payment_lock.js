onRecordCreateRequest((e) => {
  const body = e.requestInfo().body || {}
  const colabId = body.colaborador_id || e.record.getString('colaborador_id')

  if (colabId) {
    try {
      const colab = $app.findRecordById('colaboradores', colabId)
      const dataLib = colab.getString('data_liberacao')
      if (dataLib) {
        const releaseDate = new Date(dataLib)
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const releaseDay = new Date(
          releaseDate.getFullYear(),
          releaseDate.getMonth(),
          releaseDate.getDate(),
        )

        if (releaseDay > today) {
          throw new BadRequestError('Este pagamento está agendado e ainda não foi liberado.')
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

  if (colabId && body.status !== 'Cancelado') {
    try {
      const colab = $app.findRecordById('colaboradores', colabId)
      const dataLib = colab.getString('data_liberacao')
      if (dataLib) {
        const releaseDate = new Date(dataLib)
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const releaseDay = new Date(
          releaseDate.getFullYear(),
          releaseDate.getMonth(),
          releaseDate.getDate(),
        )

        if (releaseDay > today) {
          throw new BadRequestError('Este pagamento está agendado e ainda não foi liberado.')
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
      const releaseDate = new Date(dataLib)
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const releaseDay = new Date(
        releaseDate.getFullYear(),
        releaseDate.getMonth(),
        releaseDate.getDate(),
      )

      if (releaseDay > today) {
        throw new BadRequestError('Não é possível liberar um pagamento agendado para o futuro.')
      }
    }
  }

  e.next()
}, 'colaboradores')
