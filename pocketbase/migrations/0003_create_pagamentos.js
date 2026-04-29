migrate(
  (app) => {
    const colab = app.findCollectionByNameOrId('colaboradores')
    const collection = new Collection({
      name: 'pagamentos',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'colaborador_id',
          type: 'relation',
          collectionId: colab.id,
          maxSelect: 1,
          required: true,
          cascadeDelete: true,
        },
        { name: 'valor_pago', type: 'number', required: true },
        { name: 'data_pagamento', type: 'date', required: true },
        {
          name: 'foto_confirmacao',
          type: 'file',
          maxSelect: 1,
          mimeTypes: ['image/jpeg', 'image/png'],
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('pagamentos')
    app.delete(collection)
  },
)
