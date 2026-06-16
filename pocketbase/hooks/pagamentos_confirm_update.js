onRecordValidate((e) => {
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
    }
  }
  e.next()
}, 'pagamentos')
