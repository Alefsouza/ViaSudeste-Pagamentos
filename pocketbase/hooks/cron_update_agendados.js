cronAdd('update_agendados_to_pendente', '0 * * * *', () => {
  const now = new Date().toISOString().replace('T', ' ')
  const limit = 500

  while (true) {
    const records = $app.findRecordsByFilter(
      'pagamentos',
      "status = 'Agendado' && data_pagamento <= {:now}",
      '',
      limit,
      0,
      { now: now },
    )

    if (!records || records.length === 0) {
      break
    }

    for (let i = 0; i < records.length; i++) {
      const record = records[i]
      record.set('status', 'Pendente')
      $app.save(record)
    }
  }
})
