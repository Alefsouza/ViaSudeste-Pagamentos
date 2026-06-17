onRecordValidate((e) => {
  const registro = e.record.getString('registro')
  const nome = e.record.getString('nome')
  const valor_pago = e.record.getFloat('valor_pago')

  if (!registro) {
    throw new BadRequestError('Registro é obrigatório.')
  }
  if (!nome) {
    throw new BadRequestError('Nome é obrigatório.')
  }
  if (valor_pago <= 0) {
    throw new BadRequestError('Valor pago deve ser maior que zero.')
  }

  const hasUrl = !!e.record.getString('foto_confirmacao_url')
  const hasFile =
    e.record.getString('foto_confirmacao') !== '' ||
    e.findUploadedFiles('foto_confirmacao').length > 0

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
