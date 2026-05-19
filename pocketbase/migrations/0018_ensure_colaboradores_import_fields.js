migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('colaboradores')
    let changed = false

    if (!col.fields.getByName('data')) {
      col.fields.add(new DateField({ name: 'data' }))
      changed = true
    }
    if (!col.fields.getByName('idtipopgto')) {
      col.fields.add(new NumberField({ name: 'idtipopgto' }))
      changed = true
    }
    if (!col.fields.getByName('inicio')) {
      col.fields.add(new TextField({ name: 'inicio' }))
      changed = true
    }
    if (!col.fields.getByName('termino')) {
      col.fields.add(new TextField({ name: 'termino' }))
      changed = true
    }
    if (!col.fields.getByName('horas')) {
      col.fields.add(new TextField({ name: 'horas' }))
      changed = true
    }
    if (!col.fields.getByName('valor')) {
      col.fields.add(new NumberField({ name: 'valor' }))
      changed = true
    }
    if (!col.fields.getByName('filial_id')) {
      col.fields.add(new NumberField({ name: 'filial_id' }))
      changed = true
    }

    if (changed) {
      app.save(col)
    }
  },
  (app) => {
    // Revert is not required as we only ensure fields are present.
  },
)
