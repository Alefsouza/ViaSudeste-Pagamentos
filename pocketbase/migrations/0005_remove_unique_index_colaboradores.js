migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('colaboradores')
    col.removeIndex('idx_colaboradores_registro')
    app.save(col)
  },
  (app) => {
    app
      .db()
      .newQuery(`
    DELETE FROM colaboradores WHERE id NOT IN (
      SELECT MIN(id) FROM colaboradores GROUP BY registro
    ) AND registro IS NOT NULL
  `)
      .execute()

    const col = app.findCollectionByNameOrId('colaboradores')
    col.addIndex('idx_colaboradores_registro', true, 'registro', '')
    app.save(col)
  },
)
