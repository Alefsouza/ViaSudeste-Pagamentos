migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('colaboradores')
    if (!col.fields.getByName('foto_confirmacao_url')) {
      col.fields.add(new TextField({ name: 'foto_confirmacao_url' }))
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('colaboradores')
    col.fields.removeByName('foto_confirmacao_url')
    app.save(col)
  },
)
