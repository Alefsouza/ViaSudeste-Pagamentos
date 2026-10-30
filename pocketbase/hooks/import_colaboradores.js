routerAdd(
  'POST',
  '/backend/v1/import/colaboradores',
  (e) => {
    const body = e.requestInfo().body
    if (!body || !body.data || !Array.isArray(body.data)) {
      return e.badRequestError('Payload inválido: dados ausentes ou formato incorreto.')
    }

    if (body.data.length === 0) {
      return e.badRequestError('Payload inválido: nenhum registro fornecido.')
    }

    var authRecord = e.auth
    if (!authRecord) {
      return e.unauthorizedError('Autenticação necessária.')
    }
    var userRole = authRecord.getString('tipo_usuario') || ''
    if (userRole !== 'Administrador' && userRole !== 'recebedoria' && userRole !== 'DP') {
      return e.forbiddenError('Você não tem permissão para realizar esta operação.')
    }

    for (let i = 0; i < body.data.length; i++) {
      const item = body.data[i]
      if (!item.registro || String(item.registro).trim() === '') {
        return e.badRequestError(
          `Campo obrigatório 'registro' ausente ou vazio no registro ${i + 1}.`,
        )
      }
      if (!item.nome || String(item.nome).trim() === '') {
        return e.badRequestError(`Campo obrigatório 'nome' ausente ou vazio no registro ${i + 1}.`)
      }
    }

    let count = 0
    const errors = []

    $app.runInTransaction((txApp) => {
      const col = txApp.findCollectionByNameOrId('colaboradores')

      for (const item of body.data) {
        try {
          const record = new Record(col)

          record.set('registro', String(item.registro))
          record.set('nome', String(item.nome))

          if (item.horas !== undefined && item.horas !== null && String(item.horas).trim() !== '') {
            record.set('horas', String(item.horas).trim())
          } else {
            record.set('horas', '00:00')
          }

          if (item.idtipopgto !== undefined && item.idtipopgto !== '') {
            record.set('idtipopgto', Number(item.idtipopgto) || 0)
          }
          if (item.valor_a_receber !== undefined && item.valor_a_receber !== '') {
            record.set('valor_a_receber', Number(item.valor_a_receber) || 0)
          }
          if (item.valor !== undefined && item.valor !== '') {
            record.set('valor', Number(item.valor) || 0)
          }
          if (item.filial_id !== undefined && item.filial_id !== '') {
            record.set('filial_id', Number(item.filial_id) || 0)
          }
          if (item.filial && item.filial !== '') {
            record.set('filial', String(item.filial))
          }
          if (item.inicio !== undefined && item.inicio !== '') {
            record.set('inicio', String(item.inicio))
          }
          if (item.termino !== undefined && item.termino !== '') {
            record.set('termino', String(item.termino))
          }
          if (item.data !== undefined && item.data !== '') {
            record.set('data', String(item.data))
          }
          if (item.data_pagamento !== undefined && item.data_pagamento !== '') {
            record.set('data_pagamento', String(item.data_pagamento))
          }
          if (item.foto_confirmacao_url !== undefined && item.foto_confirmacao_url !== '') {
            record.set('foto_confirmacao_url', String(item.foto_confirmacao_url))
          }

          var setDateField = function (field, itemKey, bodyKey) {
            var val = item[itemKey]
            if ((!val || val === '') && bodyKey && body[bodyKey]) {
              val = body[bodyKey]
            }
            if (val && val !== '') {
              if (typeof val === 'string') {
                var d = new Date(val)
                if (isNaN(d.getTime())) {
                  throw new Error('Data inválida no campo ' + field + ': ' + val)
                }
                record.set(field, d.toISOString().replace('T', ' '))
              } else {
                record.set(field, val)
              }
            }
          }

          setDateField('data_liberacao', 'data_liberacao', 'dataLiberacao')
          setDateField('periodo_inicio', 'periodo_inicio', 'periodoInicio')
          setDateField('periodo_fim', 'periodo_fim', 'periodoFim')
          setDateField('data_pagamento_v2', 'data_pagamento_v2', null)

          var refVal = item.referencia
          if ((!refVal || refVal === '') && body.referencia !== undefined) {
            refVal = body.referencia
          }
          if (refVal !== undefined && refVal !== '') {
            var numRef = Number(refVal)
            record.set('referencia', numRef)
          }

          var isLiberado = item.liberado_pagamento !== undefined ? !!item.liberado_pagamento : true
          record.set('liberado_pagamento', isLiberado)
          if (isLiberado) {
            record.set('liberado_por', 'Importação (Planilha)')
          }

          txApp.save(record)
          count++
        } catch (err) {
          errors.push(
            `Erro na linha (Registro: ${item.registro || 'desconhecido'}): ${err.message}`,
          )
        }
      }

      try {
        txApp
          .db()
          .newQuery(
            `
          UPDATE colaboradores
          SET liberado_pagamento = 1,
              liberado_por = CASE WHEN liberado_por IS NULL OR liberado_por = '' THEN 'Importação (Janela Ativa)' ELSE liberado_por END
          WHERE referencia IN (
            SELECT DISTINCT referencia
            FROM colaboradores
            WHERE referencia IS NOT NULL
            ORDER BY referencia DESC
            LIMIT 6
          ) AND liberado_pagamento = 0
        `,
          )
          .execute()

        txApp
          .db()
          .newQuery(
            `
          UPDATE colaboradores
          SET liberado_pagamento = 0,
              liberado_por = ''
          WHERE (
            referencia IS NULL
            OR referencia NOT IN (
              SELECT DISTINCT referencia
              FROM colaboradores
              WHERE referencia IS NOT NULL
              ORDER BY referencia DESC
              LIMIT 6
            )
          ) AND liberado_pagamento = 1
        `,
          )
          .execute()
      } catch (err) {
        console.log('Erro na limpeza de referencias antigas:', err.message)
      }

      try {
        var auditCol = txApp.findCollectionByNameOrId('auditoria_liberacoes')
        var auditRecord = new Record(auditCol)
        auditRecord.set('user', authRecord.id)
        auditRecord.set(
          'responsavel',
          authRecord.getString('name') || authRecord.getString('email') || 'Usuário',
        )
        auditRecord.set('origem', 'importacao')
        auditRecord.set('acao', 'liberar')
        auditRecord.set('referencia', Number(body.referencia) || 0)
        auditRecord.set('quantidade', count)
        auditRecord.set('detalhes', {
          registros_importados: count,
          usuario_id: authRecord.id,
          usuario_email: authRecord.getString('email'),
        })
        txApp.save(auditRecord)
      } catch (auditErr) {
        console.log('Erro ao gravar auditoria na importação:', auditErr.message)
      }
    })

    return e.json(200, { count: count, errors: errors })
  },
  $apis.requireAuth(),
)
