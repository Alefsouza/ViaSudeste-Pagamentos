migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('colaboradores')
    if (!col.fields.getByName('referencia')) {
      col.fields.add(new NumberField({ name: 'referencia' }))
    }
    if (!col.fields.getByName('liberado_pagamento')) {
      col.fields.add(new BoolField({ name: 'liberado_pagamento' }))
    }
    col.addIndex('idx_colab_referencia', false, 'referencia', '')
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('colaboradores')
    col.fields.removeByName('referencia')
    col.fields.removeByName('liberado_pagamento')
    col.removeIndex('idx_colab_referencia')
    app.save(col)
  },
)
