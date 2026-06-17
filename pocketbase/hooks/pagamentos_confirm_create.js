onRecordAfterCreateSuccess((e) => {
  const colabId = e.record.getString('colaborador_id')
  const registro = e.record.getString('registro')

  let colab
  try {
    if (colabId) {
      colab = $app.findRecordById('colaboradores', colabId)
    } else if (registro) {
      colab = $app.findFirstRecordByData('colaboradores', 'registro', registro)
    } else {
      return e.next()
    }
  } catch (err) {
    return e.next() // Record Not Found
  }

  // Release Date Validation
  const dataLiberacaoStr = colab.getString('data_liberacao')
  if (dataLiberacaoStr) {
    const dataLiberacao = new Date(dataLiberacaoStr)
    const agora = new Date()
    if (agora < dataLiberacao) {
      throw new BadRequestError(
        'Não é possível confirmar o pagamento: a data atual é anterior à data de liberação.',
        {
          data_liberacao: new ValidationError('invalid_date', 'Data de liberação não atingida'),
        },
      )
    }
  }

  const status = e.record.getString('status')

  if (status === 'Confirmado') {
    // Date Formatting & Synchronization
    const pgtoDataStr = e.record.getString('data_pagamento')
    if (pgtoDataStr) {
      const d = new Date(pgtoDataStr)
      if (!isNaN(d.getTime())) {
        const pad = (n) => n.toString().padStart(2, '0')
        const formattedDate = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
        colab.set('data_pagamento', formattedDate)

        // PocketBase internal date string format for datetime fields
        const isoString = d.toISOString().replace('T', ' ')
        colab.set('data_pagamento_v2', isoString)
      }
    }

    // Mandatory Fields Integrity
    const nomePgto = e.record.getString('nome')
    const registroPgto = e.record.getString('registro')
    if (!colab.getString('nome') && nomePgto) {
      colab.set('nome', nomePgto)
    }
    if (!colab.getString('registro') && registroPgto) {
      colab.set('registro', registroPgto)
    }

    // Data Synchronization: adjust valor_a_receber
    const valorPago = e.record.getFloat('valor_pago')
    const atualReceber = colab.getFloat('valor_a_receber')
    const novoValor = Math.max(0, atualReceber - valorPago)
    colab.set('valor_a_receber', novoValor)

    // Status Persistence: Update foto url
    const fotoUrl = e.record.getString('foto_confirmacao_url')
    if (fotoUrl) {
      colab.set('foto_confirmacao_url', fotoUrl)
    }

    colab.set('liberado_pagamento', true)

    $app.save(colab)

    // Audit Logging
    try {
      const logsCol = $app.findCollectionByNameOrId('api_audit_logs')
      const logRecord = new Record(logsCol)
      const userId = e.record.getString('user_id')
      if (userId) {
        logRecord.set('user', userId)
        logRecord.set('endpoint', 'hook:pagamentos_confirm_create')
        logRecord.set('status', 200)
        $app.save(logRecord)
      }
    } catch (logErr) {
      console.log('Error saving audit log', logErr.message)
    }
  }

  return e.next()
}, 'pagamentos')
