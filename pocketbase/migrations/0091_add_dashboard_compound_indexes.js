migrate(
  (app) => {
    const colab = app.findCollectionByNameOrId('colaboradores')
    colab.addIndex('idx_colab_ref_liberado', false, 'referencia,liberado_pagamento', '')
    app.save(colab)

    const pags = app.findCollectionByNameOrId('pagamentos')
    pags.addIndex('idx_pagamentos_status_idtipopgto', false, 'status,idtipopgto', '')
    app.save(pags)
  },
  (app) => {
    const colab = app.findCollectionByNameOrId('colaboradores')
    colab.removeIndex('idx_colab_ref_liberado')
    app.save(colab)

    const pags = app.findCollectionByNameOrId('pagamentos')
    pags.removeIndex('idx_pagamentos_status_idtipopgto')
    app.save(pags)
  },
)
