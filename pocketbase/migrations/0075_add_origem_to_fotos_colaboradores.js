migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('fotos_colaboradores')
    if (!col.fields.getByName('origem')) {
      col.fields.add(
        new SelectField({
          name: 'origem',
          required: false,
          values: ['captura', 'lote'],
          maxSelect: 1,
        }),
      )
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('fotos_colaboradores')
    const field = col.fields.getByName('origem')
    if (field) {
      col.fields.removeByName('origem')
    }
    app.save(col)
  },
)
