migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('pagamentos')

    if (!col.fields.getByName('status')) {
      col.fields.add(
        new SelectField({
          name: 'status',
          values: ['Confirmado', 'Pendente'],
          maxSelect: 1,
        }),
      )
    }

    if (!col.fields.getByName('tipo_pagamento')) {
      col.fields.add(
        new TextField({
          name: 'tipo_pagamento',
        }),
      )
    }

    if (!col.fields.getByName('user_id')) {
      col.fields.add(
        new RelationField({
          name: 'user_id',
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('pagamentos')
    col.fields.removeByName('status')
    col.fields.removeByName('tipo_pagamento')
    col.fields.removeByName('user_id')
    app.save(col)
  },
)
