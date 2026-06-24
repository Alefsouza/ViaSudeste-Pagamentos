onRecordCreate((e) => {
  const dataLiberacao = e.record.getString('data_liberacao')
  if (dataLiberacao) {
    const match = dataLiberacao.match(/^(\d{4}-\d{2}-\d{2})/)
    if (match) {
      e.record.set('data_liberacao', match[1] + ' 11:00:00.000Z')
    }
  }
  return e.next()
}, 'colaboradores')

onRecordUpdate((e) => {
  const dataLiberacao = e.record.getString('data_liberacao')
  if (dataLiberacao) {
    const match = dataLiberacao.match(/^(\d{4}-\d{2}-\d{2})/)
    if (match) {
      e.record.set('data_liberacao', match[1] + ' 11:00:00.000Z')
    }
  }
  return e.next()
}, 'colaboradores')
