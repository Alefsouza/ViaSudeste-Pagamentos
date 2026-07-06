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
    const results = []

    for (let i = 0; i < payments.length; i++) {
      const payment = payments[i]
      try {
        var photoFile = null
        try {
          var files = e.findUploadedFiles('photo_' + i)
          if (files && files.length > 0) photoFile = files[0]
        } catch (err) {}

        var existingId = null
        if (payment.colaborador_id) {
          try {
            var filterStr = 'colaborador_id="' + payment.colaborador_id + '"'
            if (payment.inicio) filterStr += ' && inicio="' + payment.inicio + '"'
            var existing = $app.findFirstRecordByFilter('pagamentos', filterStr)
            existingId = existing.id
          } catch (err) {}
        }

        var now = new Date().toISOString()
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
        record.set('data_pagamento', payment.data_pagamento || now)
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
        if (photoFile) record.set('foto_confirmacao', photoFile)

        $app.save(record)

        if (photoFile) {
          var savedFile = record.getString('foto_confirmacao')
          if (savedFile) {
            var fileUrl = baseUrl + '/api/files/pagamentos/' + record.id + '/' + savedFile
            $app
              .db()
              .newQuery('UPDATE pagamentos SET foto_confirmacao_url = {:url} WHERE id = {:id}')
              .bind({ url: fileUrl, id: record.id })
              .execute()
            if (payment.colaborador_id) {
              $app
                .db()
                .newQuery('UPDATE colaboradores SET foto_confirmacao_url = {:url} WHERE id = {:id}')
                .bind({ url: fileUrl, id: payment.colaborador_id })
                .execute()
            }
          }
        }

        results.push({ index: i, success: true, colaborador_id: payment.colaborador_id })
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
