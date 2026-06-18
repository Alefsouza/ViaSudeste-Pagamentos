onRecordAfterUpdateSuccess((e) => {
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
    return e.next()
  }

  const status = e.record.getString('status')
  const originalStatus = e.record.original().getString('status')

  if (status === 'Confirmado') {
    // Release Date Validation (Timezone-Aware: UTC-3, Date-Only)
    const dataLiberacaoStr = colab.getString('data_liberacao')
    if (dataLiberacaoStr) {
      const dataLiberacaoDate = new Date(dataLiberacaoStr)
      const agoraUtc3 = new Date(Date.now() - 3 * 3600000)

      const todayStr = `${agoraUtc3.getUTCFullYear()}-${String(agoraUtc3.getUTCMonth() + 1).padStart(2, '0')}-${String(agoraUtc3.getUTCDate()).padStart(2, '0')}`
      const libStr = `${dataLiberacaoDate.getUTCFullYear()}-${String(dataLiberacaoDate.getUTCMonth() + 1).padStart(2, '0')}-${String(dataLiberacaoDate.getUTCDate()).padStart(2, '0')}`

      if (todayStr < libStr) {
        throw new BadRequestError(
          'Não é possível confirmar o pagamento: a data atual é anterior à data de liberação.',
          {
            status: new ValidationError('invalid_date', 'Data de liberação não atingida'),
          },
        )
      }
    }

    // Date Formatting & Synchronization
    const pgtoDataStr = e.record.getString('data_pagamento')
    if (pgtoDataStr) {
      const d = new Date(pgtoDataStr)
      if (!isNaN(d.getTime())) {
        const pad = (n) => n.toString().padStart(2, '0')
        const formattedDate = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
        colab.set('data_pagamento', formattedDate)

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

    // Data Synchronization: adjust valor_a_receber only if transitioned to Confirmado
    if (originalStatus !== 'Confirmado') {
      const valorPago = e.record.getFloat('valor_pago')
      const atualReceber = colab.getFloat('valor_a_receber')
      const novoValor = Math.max(0, atualReceber - valorPago)
      colab.set('valor_a_receber', novoValor)
    }

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
        logRecord.set('endpoint', 'hook:pagamentos_confirm_update (Confirmado)')
        logRecord.set('status', 200)
        $app.save(logRecord)
      }
    } catch (logErr) {
      console.log('Error saving audit log', logErr.message)
    }
  } else if (status === 'Cancelado') {
    colab.set('liberado_pagamento', false)

    if (originalStatus === 'Confirmado') {
      // Revert value adjustment
      const valorPago = e.record.getFloat('valor_pago')
      const atualReceber = colab.getFloat('valor_a_receber')
      colab.set('valor_a_receber', atualReceber + valorPago)
    }

    $app.save(colab)

    // Audit Logging
    try {
      const logsCol = $app.findCollectionByNameOrId('api_audit_logs')
      const logRecord = new Record(logsCol)
      const userId = e.record.getString('user_id')
      if (userId) {
        logRecord.set('user', userId)
        logRecord.set('endpoint', 'hook:pagamentos_confirm_update (Cancelado)')
        logRecord.set('status', 200)
        $app.save(logRecord)
      }
    } catch (logErr) {
      console.log('Error saving audit log', logErr.message)
    }
  }

  return e.next()
}, 'pagamentos')
