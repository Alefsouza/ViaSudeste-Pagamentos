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
      let cleanStr = dataLiberacaoStr
      if (cleanStr.includes(' ') && !cleanStr.includes('T')) cleanStr = cleanStr.replace(' ', 'T')
      if (
        !cleanStr.endsWith('Z') &&
        cleanStr.split('T').length === 2 &&
        !cleanStr.includes('+') &&
        !cleanStr.match(/-\d{2}:\d{2}$/)
      ) {
        cleanStr += 'Z'
      }
      const dataLiberacaoDate = new Date(cleanStr)
      if (!isNaN(dataLiberacaoDate.getTime())) {
        const now = new Date()
        if (now.getTime() < dataLiberacaoDate.getTime()) {
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
