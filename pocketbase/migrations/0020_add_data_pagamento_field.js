migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('colaboradores')
    if (!col.fields.getByName('data_pagamento')) {
      col.fields.add(
        new TextField({
          name: 'data_pagamento',
          required: false,
        }),
      )
      app.save(col)
    }
  },
  (app) => {
    const col = app.findCollectionByNameOrId('colaboradores')
    if (col.fields.getByName('data_pagamento')) {
      col.fields.removeByName('data_pagamento')
      app.save(col)
    }
  },
)
