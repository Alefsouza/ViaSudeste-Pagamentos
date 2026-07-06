migrate(
  (app) => {
    const colab = app.findCollectionByNameOrId('colaboradores')
    colab.addIndex('idx_colab_filial_id', false, 'filial_id', '')
    colab.addIndex('idx_colab_liberado_pagamento', false, 'liberado_pagamento', '')
    app.save(colab)

    const pags = app.findCollectionByNameOrId('pagamentos')
    pags.addIndex('idx_pagamentos_status', false, 'status', '')
    pags.addIndex('idx_pagamentos_data_pagamento', false, 'data_pagamento', '')
    pags.addIndex('idx_pagamentos_colaborador_id', false, 'colaborador_id', '')
    app.save(pags)
  },
  (app) => {
    const colab = app.findCollectionByNameOrId('colaboradores')
    colab.removeIndex('idx_colab_filial_id')
    colab.removeIndex('idx_colab_liberado_pagamento')
    app.save(colab)

    const pags = app.findCollectionByNameOrId('pagamentos')
    pags.removeIndex('idx_pagamentos_status')
    pags.removeIndex('idx_pagamentos_data_pagamento')
    pags.removeIndex('idx_pagamentos_colaborador_id')
    app.save(pags)
  },
)
