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

  const status = e.record.getString('status')

  // Ensure relation is established if missing
  if (status === 'Pendente' || status === 'Confirmado' || status === 'Cancelado') {
    if (!colabId && colab) {
      try {
        const recordToUpdate = $app.findRecordById('pagamentos', e.record.id)
        recordToUpdate.set('colaborador_id', colab.id)
        $app.save(recordToUpdate)
      } catch (err) {
        console.log('Error updating colaborador_id relation', err.message)
      }
    }
  }

  if (status === 'Confirmado') {
    const fotoUrl = e.record.getString('foto_confirmacao_url')
    const fotoFile = e.record.getString('foto_confirmacao')
    const colabFotoUrl = colab ? colab.getString('foto_confirmacao_url') : ''

    if (!fotoUrl && !fotoFile && !colabFotoUrl) {
      throw new BadRequestError(
        'Não é possível confirmar o pagamento: a foto de confirmação é obrigatória.',
        {
          status: new ValidationError(
            'missing_photo',
            'A foto de confirmação é obrigatória para o status Confirmado',
          ),
        },
      )
    }

    // Release Date Validation (Exact Time: 11:00 UTC = 08:00 BRT)
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
      const now = new Date()

      if (now.getTime() < dataLiberacaoDate.getTime()) {
        throw new BadRequestError(
          'Não é possível confirmar o pagamento: a data atual é anterior à data de liberação.',
          {
            data_liberacao: new ValidationError('invalid_date', 'Data de liberação não atingida'),
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
