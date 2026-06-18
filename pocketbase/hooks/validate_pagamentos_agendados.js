onRecordValidate((e) => {
  const status = e.record.getString('status')
  if (status !== 'Confirmado') {
    return e.next()
  }

  const colabId = e.record.get('colaborador_id')
  if (!colabId) return e.next()

  try {
    const colab = $app.findRecordById('colaboradores', colabId)
    const dataLiberacaoStr = colab.getString('data_liberacao')

    if (dataLiberacaoStr) {
      const dataLiberacaoDate = new Date(dataLiberacaoStr)
      if (!isNaN(dataLiberacaoDate.getTime())) {
        const agoraUtc3 = new Date(Date.now() - 3 * 3600000)
        const pad = (n) => n.toString().padStart(2, '0')
        const todayStr = `${agoraUtc3.getUTCFullYear()}-${pad(agoraUtc3.getUTCMonth() + 1)}-${pad(agoraUtc3.getUTCDate())}`
        const libStr = `${dataLiberacaoDate.getUTCFullYear()}-${pad(dataLiberacaoDate.getUTCMonth() + 1)}-${pad(dataLiberacaoDate.getUTCDate())}`

        if (todayStr < libStr) {
          throw new BadRequestError(
            'Pagamento agendado não pode ser confirmado antes da data de liberação.',
            {
              status: new ValidationError(
                'invalid_status',
                'Registro agendado não pode ser processado.',
              ),
            },
          )
        }
      }
    }
  } catch (err) {
    if (err instanceof BadRequestError) throw err
  }

  return e.next()
}, 'pagamentos')
