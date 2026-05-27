migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('fotos_colaboradores')
    col.fields.add(
      new SelectField({
        name: 'filial',
        required: false,
        values: ['Cursino', 'Sapopemba'],
        maxSelect: 1,
      }),
    )
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('fotos_colaboradores')
    col.fields.add(
      new SelectField({
        name: 'filial',
        required: true,
        values: ['Cursino', 'Sapopemba'],
        maxSelect: 1,
      }),
    )
    app.save(col)
  },
)
