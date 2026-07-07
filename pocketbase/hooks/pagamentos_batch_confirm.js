routerAdd(
  'POST',
  '/backend/v1/pagamentos/batch-confirm',
  (e) => {
    const body = e.requestInfo().body || {}
    const paymentsJson = body.payments

    if (!paymentsJson) return e.badRequestError('payments data is required')

    let payments
    try {
      payments = JSON.parse(paymentsJson)
    } catch (err) {
      return e.badRequestError('Invalid payments JSON')
    }

    if (!Array.isArray(payments) || payments.length === 0) {
      return e.badRequestError('No payments provided')
    }

    const authRecord = e.auth
    if (!authRecord) return e.unauthorizedError('Authentication required')

    const tipoUsuario = authRecord.getString('tipo_usuario') || ''
    if (tipoUsuario !== 'Administrador' && tipoUsuario !== 'recebedoria') {
      return e.forbiddenError('Only administrators and recebedoria can confirm payments')
    }

    const userId = authRecord.id
    const baseUrl = $secrets.get('PB_INSTANCE_URL') || ''
    const pagamentosCol = $app.findCollectionByNameOrId('pagamentos')
    const logsCol = $app.findCollectionByNameOrId('api_audit_logs')
    const results = []
    let firstPhotoUrl = null

    for (let i = 0; i < payments.length; i++) {
      const payment = payments[i]
      try {
        var photoFile = null
        try {
          var files = e.findUploadedFiles('photo_' + i)
          if (files && files.length > 0) photoFile = files[0]
        } catch (err) {}

        var existingId = null
        var existingStatus = ''

        if (payment.pagamento_id) {
          try {
            var existingById = $app.findRecordById('pagamentos', payment.pagamento_id)
            existingId = existingById.id
            existingStatus = existingById.getString('status')
          } catch (err) {}
        }

        if (!existingId && payment.colaborador_id) {
          try {
            var filterStr = 'colaborador_id="' + payment.colaborador_id + '"'
            if (payment.inicio) filterStr += ' && inicio="' + payment.inicio + '"'
            var existing = $app.findFirstRecordByFilter('pagamentos', filterStr)
            existingId = existing.id
            existingStatus = existing.getString('status')
          } catch (err) {}
        }

        if (existingId && existingStatus === 'Confirmado') {
          results.push({
            index: i,
            success: true,
            skipped: true,
            colaborador_id: payment.colaborador_id,
            message: 'Payment already confirmed',
          })
          continue
        }

        var colab = null
        if (payment.colaborador_id) {
          try {
            colab = $app.findRecordById('colaboradores', payment.colaborador_id)
          } catch (err) {
            if (payment.registro) {
              try {
                colab = $app.findFirstRecordByData('colaboradores', 'registro', payment.registro)
              } catch (err2) {}
            }
          }
        }

        if (colab) {
          var dataLiberacaoStr = colab.getString('data_liberacao')
          if (dataLiberacaoStr && existingStatus !== 'Pendente') {
            var cleanStr = dataLiberacaoStr
            if (cleanStr.includes(' ') && !cleanStr.includes('T'))
              cleanStr = cleanStr.replace(' ', 'T')
            if (
              !cleanStr.endsWith('Z') &&
              cleanStr.split('T').length === 2 &&
              !cleanStr.includes('+') &&
              !cleanStr.match(/-\d{2}:\d{2}$/)
            ) {
              cleanStr += 'Z'
            }
            var dataLiberacaoDate = new Date(cleanStr)
            var now = new Date()
            if (
              !isNaN(dataLiberacaoDate.getTime()) &&
              now.getTime() < dataLiberacaoDate.getTime()
            ) {
              results.push({
                index: i,
                success: false,
                error: 'Data de liberação não atingida',
                colaborador_id: payment.colaborador_id,
              })
              continue
            }
          }
        }

        var colabFotoUrl = colab ? colab.getString('foto_confirmacao_url') : ''
        if (!photoFile && !firstPhotoUrl && !colabFotoUrl && !payment.foto_confirmacao_url) {
          results.push({
            index: i,
            success: false,
            error: 'Foto de confirmação é obrigatória',
            colaborador_id: payment.colaborador_id,
          })
          continue
        }

        var fotoUrlForRecord = payment.foto_confirmacao_url || firstPhotoUrl || colabFotoUrl || ''

        var nowDate = new Date().toISOString()
        var record
        if (existingId) {
          record = $app.findRecordById('pagamentos', existingId)
        } else {
          record = new Record(pagamentosCol)
          record.set('colaborador_id', payment.colaborador_id || '')
        }

        record.set('registro', payment.registro || '')
        record.set('nome', payment.nome || '')
        record.set('valor_pago', Number(payment.valor_pago) || 0)
        record.set('data_pagamento', payment.data_pagamento || nowDate)
        record.set('hora_pagamento', payment.hora_pagamento || '')
        record.set('status', 'Confirmado')
        record.set('user_id', userId)
        if (payment.idtipopgto != null) record.set('idtipopgto', Number(payment.idtipopgto))
        if (payment.tipo_pagamento) record.set('tipo_pagamento', payment.tipo_pagamento)
        if (payment.inicio) record.set('inicio', payment.inicio)
        if (payment.termino) record.set('termino', payment.termino)
        if (payment.horas) record.set('horas', payment.horas)
        if (payment.filial != null && payment.filial !== '')
          record.set('filial', Number(payment.filial))
        if (fotoUrlForRecord) record.set('foto_confirmacao_url', fotoUrlForRecord)
        if (photoFile) record.set('foto_confirmacao', photoFile)

        $app.save(record)

        if (photoFile) {
          var savedFile = record.getString('foto_confirmacao')
          if (savedFile) {
            firstPhotoUrl = baseUrl + '/api/files/pagamentos/' + record.id + '/' + savedFile
            $app
              .db()
              .newQuery('UPDATE pagamentos SET foto_confirmacao_url = {:url} WHERE id = {:id}')
              .bind({ url: firstPhotoUrl, id: record.id })
              .execute()
          }
        }

        if (firstPhotoUrl && payment.colaborador_id) {
          $app
            .db()
            .newQuery('UPDATE colaboradores SET foto_confirmacao_url = {:url} WHERE id = {:id}')
            .bind({ url: firstPhotoUrl, id: payment.colaborador_id })
            .execute()
        }

        try {
          var logRecord = new Record(logsCol)
          logRecord.set('user', userId)
          logRecord.set('endpoint', 'hook:pagamentos_batch_confirm')
          logRecord.set('status', 200)
          $app.save(logRecord)
        } catch (logErr) {
          console.log('Error saving audit log', logErr.message)
        }

        results.push({
          index: i,
          success: true,
          colaborador_id: payment.colaborador_id,
          pagamento_id: record.id,
        })
      } catch (err) {
        results.push({
          index: i,
          success: false,
          error: err.message || 'Unknown error',
          colaborador_id: payment.colaborador_id,
        })
      }
    }

    return e.json(200, { results })
  },
  $apis.requireAuth(),
)
