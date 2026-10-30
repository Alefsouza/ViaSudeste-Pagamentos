migrate(
  (app) => {
    // 1. Adicionar o campo `liberado_por` na coleção `colaboradores` se não existir
    const col = app.findCollectionByNameOrId('colaboradores')
    if (!col.fields.getByName('liberado_por')) {
      col.fields.add(
        new TextField({
          name: 'liberado_por',
          required: false,
        }),
      )
      app.save(col)
    }

    // 2. Criar coleção `auditoria_liberacoes` se não existir para registrar histórico detalhado de eventos de liberação
    try {
      app.findCollectionByNameOrId('auditoria_liberacoes')
    } catch (_) {
      const usersCol = app.findCollectionByNameOrId('users')
      const auditCol = new Collection({
        name: 'auditoria_liberacoes',
        type: 'base',
        listRule: "@request.auth.id != ''",
        viewRule: "@request.auth.id != ''",
        createRule: "@request.auth.id != ''",
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'user',
            type: 'relation',
            collectionId: usersCol.id,
            maxSelect: 1,
            required: false,
          },
          { name: 'responsavel', type: 'text', required: false },
          { name: 'origem', type: 'text', required: false },
          { name: 'acao', type: 'text', required: false }, // 'liberar' ou 'bloquear'
          { name: 'colaborador_id', type: 'text', required: false },
          { name: 'registro', type: 'text', required: false },
          { name: 'nome', type: 'text', required: false },
          { name: 'referencia', type: 'number', required: false },
          { name: 'quantidade', type: 'number', required: false },
          { name: 'detalhes', type: 'json', required: false },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
      })
      app.save(auditCol)
    }

    // 3. CORREÇÃO DOS DADOS (idempotente):
    // Na coleção colaboradores, para registros com referencia = 9, liberado_pagamento = true
    // e SEM pagamento confirmado (sem foto_confirmacao_url ou foto_confirmacao_url vazia),
    // voltar liberado_pagamento = false.
    // Em banco vazio ou sem esses registros, é um no-op seguro.
    app
      .db()
      .newQuery(
        `UPDATE colaboradores
         SET liberado_pagamento = 0
         WHERE referencia = 9
           AND liberado_pagamento = 1
           AND (foto_confirmacao_url IS NULL OR foto_confirmacao_url = '')`,
      )
      .execute()
  },
  (app) => {
    // Reversão
    try {
      const auditCol = app.findCollectionByNameOrId('auditoria_liberacoes')
      app.delete(auditCol)
    } catch (_) {}

    try {
      const col = app.findCollectionByNameOrId('colaboradores')
      if (col.fields.getByName('liberado_por')) {
        col.fields.removeByName('liberado_por')
        app.save(col)
      }
    } catch (_) {}
  },
)
