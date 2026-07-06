migrate(
  (app) => {
    const colab = app.findCollectionByNameOrId('colaboradores')
    colab.addIndex('idx_colab_registro_lookup', false, 'registro', '')
    app.save(colab)

    const pags = app.findCollectionByNameOrId('pagamentos')
    pags.addIndex('idx_pagamentos_status_data', false, 'status,data_pagamento', '')
    pags.addIndex('idx_pagamentos_colab_status', false, 'colaborador_id,status', '')
    app.save(pags)
  },
  (app) => {
    const colab = app.findCollectionByNameOrId('colaboradores')
    colab.removeIndex('idx_colab_registro_lookup')
    app.save(colab)

    const pags = app.findCollectionByNameOrId('pagamentos')
    pags.removeIndex('idx_pagamentos_status_data')
    pags.removeIndex('idx_pagamentos_colab_status')
    app.save(pags)
  },
)
