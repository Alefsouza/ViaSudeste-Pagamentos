migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('colaboradores')
    col.fields.removeByName('data')
    col.fields.add(new TextField({ name: 'data' }))
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('colaboradores')
    col.fields.removeByName('data')
    col.fields.add(new DateField({ name: 'data' }))
    app.save(col)
  },
)
