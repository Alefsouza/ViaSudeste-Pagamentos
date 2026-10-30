migrate(
  (app) => {
    // 1. Adicionar campo `observacao` na coleção pagamentos (se não existir)
    const pagCol = app.findCollectionByNameOrId('pagamentos')
    if (!pagCol.fields.getByName('observacao')) {
      pagCol.fields.add(
        new TextField({
          name: 'observacao',
          required: false,
        }),
      )
      app.save(pagCol)
    }

    // 2. Coleção atualizada para criar Record
    const pagamentosCollection = app.findCollectionByNameOrId('pagamentos')

    // 3. Pagamentos a reconstruir com base nos eventos confirmados no api_audit_logs e comprovantes legíveis:
    // Evento 1: 26/10 22:44 BRT (27/10 01:44:57 UTC) - Rafael Campos (Sapopemba)
    // Comprovante: "PAG D HORA EXTRA SISTEMA - RAFAEL C - R$ 296,94"
    // Evento 2: 27/10 15:05 BRT (27/10 18:05:19 UTC) - Sonia Gorete (Cursino)
    // Comprovante: R$ 110,41
    // Evento 3: 27/10 20:14 BRT (27/10 23:14:53 UTC) - Ana Ribeiro (Cursino)
    // Comprovante: R$ 281,28
    // Evento 4: 29/10 13:57 BRT (29/10 16:57:37 UTC) - Rafael Rodrigues (Sapopemba)
    // Confirmação do usuário: R$ 179,80 - Reg 4976 (MARIA APARECIDA DE LIMA)
    const paymentsToRestore = [
      {
        data_pagamento: '2026-10-27 01:44:57.670Z',
        hora_pagamento: '22:44',
        valor_pago: 296.94,
        status: 'Confirmado',
        tipo_pagamento: 'Hora Extra',
        idtipopgto: 1,
        filial: 4,
        user_id: 'ox5fy5lh53zt20i', // Rafael Campos
        registro: '',
        nome: 'PAG D HORA EXTRA SISTEMA - RAFAEL C',
        observacao:
          'RECONSTRUÇÃO — registro recriado após exclusão pela purge da referência; sem foto (Audit log: 27/10 01:44:57 UTC / 26/10 22:44 BRT, user Rafael Campos, comprovante R$ 296,94)',
      },
      {
        data_pagamento: '2026-10-27 18:05:19.008Z',
        hora_pagamento: '15:05',
        valor_pago: 110.41,
        status: 'Confirmado',
        tipo_pagamento: 'Hora Extra',
        idtipopgto: 1,
        filial: 2,
        user_id: 'hz129j68c1grzlt', // Sonia Gorete
        registro: '',
        nome: 'COMPROVANTE RECEBEDORIA - SONIA GORETE',
        observacao:
          'RECONSTRUÇÃO — registro recriado após exclusão pela purge da referência; sem foto (Audit log: 27/10 18:05:19 UTC / 27/10 15:05 BRT, user Sonia Gorete, comprovante R$ 110,41)',
      },
      {
        data_pagamento: '2026-10-27 23:14:53.008Z',
        hora_pagamento: '20:14',
        valor_pago: 281.28,
        status: 'Confirmado',
        tipo_pagamento: 'Hora Extra',
        idtipopgto: 1,
        filial: 2,
        user_id: 'np788drgrky8kno', // Ana Ribeiro
        registro: '',
        nome: 'COMPROVANTE RECEBEDORIA - ANA RIBEIRO',
        observacao:
          'RECONSTRUÇÃO — registro recriado após exclusão pela purge da referência; sem foto (Audit log: 27/10 23:14:53 UTC / 27/10 20:14 BRT, user Ana Ribeiro, comprovante R$ 281,28)',
      },
      {
        data_pagamento: '2026-10-29 16:57:37.497Z',
        hora_pagamento: '13:57',
        valor_pago: 179.8,
        status: 'Confirmado',
        tipo_pagamento: 'Hora Extra',
        idtipopgto: 1,
        filial: 4,
        user_id: '4ipxmp595ex66fz', // Rafael Rodrigues
        registro: '4976',
        nome: 'MARIA APARECIDA DE LIMA',
        observacao:
          'RECONSTRUÇÃO — registro recriado após exclusão pela purge da referência; sem foto (Audit log: 29/10 16:57:37 UTC / 29/10 13:57 BRT, user Rafael Rodrigues, reg. 4976, R$ 179,80)',
      },
    ]

    for (let i = 0; i < paymentsToRestore.length; i++) {
      const item = paymentsToRestore[i]
      // Verificação idempotente antes de inserir (por data_pagamento aproximada, valor_pago e user_id)
      const existing = app.findRecordsByFilter(
        'pagamentos',
        `user_id = "${item.user_id}" && valor_pago = ${item.valor_pago} && hora_pagamento = "${item.hora_pagamento}"`,
        '',
        1,
        0,
      )

      if (existing.length === 0) {
        const record = new Record(pagamentosCollection)
        record.set('valor_pago', item.valor_pago)
        record.set('data_pagamento', item.data_pagamento)
        record.set('hora_pagamento', item.hora_pagamento)
        record.set('status', item.status)
        record.set('tipo_pagamento', item.tipo_pagamento)
        record.set('idtipopgto', item.idtipopgto)
        record.set('filial', item.filial)
        record.set('user_id', item.user_id)
        record.set('registro', item.registro)
        record.set('nome', item.nome)
        record.set('foto_confirmacao_url', '')
        record.set('observacao', item.observacao)
        // colaborador_id e foto_confirmacao ficam vazios por regra
        app.save(record)
      } else {
        // Garantir que observacao e filial estão atualizados caso já existisse
        const rec = existing[0]
        let changed = false
        if (rec.getString('observacao') !== item.observacao) {
          rec.set('observacao', item.observacao)
          changed = true
        }
        if (rec.getInt('filial') !== item.filial) {
          rec.set('filial', item.filial)
          changed = true
        }
        if (rec.getString('nome') !== item.nome) {
          rec.set('nome', item.nome)
          changed = true
        }
        if (changed) {
          app.save(rec)
        }
      }
    }

    // Atualização direta para garantir que registros recém-inseridos na etapa 1 fiquem com a observacao preenchida
    for (let j = 0; j < paymentsToRestore.length; j++) {
      const item = paymentsToRestore[j]
      app
        .db()
        .newQuery(
          `UPDATE pagamentos
         SET observacao = {:obs}, filial = {:filial}, nome = {:nome}
         WHERE user_id = {:userId} AND valor_pago = {:val} AND hora_pagamento = {:hora}`,
        )
        .bind({
          obs: item.observacao,
          filial: item.filial,
          nome: item.nome,
          userId: item.user_id,
          val: item.valor_pago,
          hora: item.hora_pagamento,
        })
        .execute()
    }
  },
  (app) => {
    // Reversão
    try {
      app
        .db()
        .newQuery(
          "DELETE FROM pagamentos WHERE observacao LIKE 'RECONSTRUÇÃO — registro recriado%'",
        )
        .execute()
    } catch (_) {}

    try {
      const col = app.findCollectionByNameOrId('pagamentos')
      if (col.fields.getByName('observacao')) {
        col.fields.removeByName('observacao')
        app.save(col)
      }
    } catch (_) {}
  },
)
