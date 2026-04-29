migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('colaboradores')
    col.fields.add(new TextField({ name: 'foto_url' }))
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('colaboradores')
    col.fields.removeByName('foto_url')
    app.save(col)
  },
)
