migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('colaboradores')

    const valorAReceber = col.fields.getByName('valor_a_receber')
    if (valorAReceber) valorAReceber.required = false

    const filial = col.fields.getByName('filial')
    if (filial) filial.required = false

    if (!col.fields.getByName('data')) col.fields.add(new DateField({ name: 'data' }))
    if (!col.fields.getByName('idtipopgto')) col.fields.add(new NumberField({ name: 'idtipopgto' }))
    if (!col.fields.getByName('inicio')) col.fields.add(new TextField({ name: 'inicio' }))
    if (!col.fields.getByName('termino')) col.fields.add(new TextField({ name: 'termino' }))
    if (!col.fields.getByName('horas')) col.fields.add(new TextField({ name: 'horas' }))
    if (!col.fields.getByName('valor')) col.fields.add(new NumberField({ name: 'valor' }))
    if (!col.fields.getByName('filial_id')) col.fields.add(new NumberField({ name: 'filial_id' }))

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('colaboradores')

    col.fields.removeByName('data')
    col.fields.removeByName('idtipopgto')
    col.fields.removeByName('inicio')
    col.fields.removeByName('termino')
    col.fields.removeByName('horas')
    col.fields.removeByName('valor')
    col.fields.removeByName('filial_id')

    const valorAReceber = col.fields.getByName('valor_a_receber')
    if (valorAReceber) valorAReceber.required = true

    const filial = col.fields.getByName('filial')
    if (filial) filial.required = true

    app.save(col)
  },
)
