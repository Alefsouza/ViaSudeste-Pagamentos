migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('colaboradores')
    col.fields.removeByName('foto')
    col.fields.removeByName('foto_url')
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('colaboradores')
    if (!col.fields.getByName('foto')) {
      col.fields.add(new FileField({ name: 'foto', maxSelect: 1 }))
    }
    if (!col.fields.getByName('foto_url')) {
      col.fields.add(new TextField({ name: 'foto_url' }))
    }
    app.save(col)
  },
)
