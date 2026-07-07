migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('colaboradores')
    if (!col.fields.getByName('horas')) {
      col.fields.add(new TextField({ name: 'horas' }))
      app.save(col)
    }

    const pagCol = app.findCollectionByNameOrId('pagamentos')
    if (!pagCol.fields.getByName('horas')) {
      pagCol.fields.add(new TextField({ name: 'horas' }))
      app.save(pagCol)
    }
  },
  (app) => {},
)
