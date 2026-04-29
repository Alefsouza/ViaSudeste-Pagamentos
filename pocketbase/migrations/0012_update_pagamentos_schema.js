migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('pagamentos')
    if (!col.fields.getByName('hora_pagamento')) {
      col.fields.add(new TextField({ name: 'hora_pagamento' }))
    }
    if (!col.fields.getByName('foto_confirmacao_url')) {
      col.fields.add(new TextField({ name: 'foto_confirmacao_url' }))
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('pagamentos')
    col.fields.removeByName('hora_pagamento')
    col.fields.removeByName('foto_confirmacao_url')
    app.save(col)
  },
)
