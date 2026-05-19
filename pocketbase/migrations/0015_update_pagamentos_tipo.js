migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('pagamentos')

    if (!col.fields.getByName('idtipopgto')) {
      col.fields.add(new NumberField({ name: 'idtipopgto' }))
    }
    if (!col.fields.getByName('horas')) {
      col.fields.add(new NumberField({ name: 'horas' }))
    }
    if (!col.fields.getByName('inicio')) {
      col.fields.add(new TextField({ name: 'inicio' }))
    }
    if (!col.fields.getByName('termino')) {
      col.fields.add(new TextField({ name: 'termino' }))
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('pagamentos')
    col.fields.removeByName('idtipopgto')
    col.fields.removeByName('horas')
    col.fields.removeByName('inicio')
    col.fields.removeByName('termino')
    app.save(col)
  },
)
