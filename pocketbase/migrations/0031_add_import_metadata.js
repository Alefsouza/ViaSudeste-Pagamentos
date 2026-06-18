migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('colaboradores')

    if (!col.fields.getByName('data_liberacao')) {
      col.fields.add(new DateField({ name: 'data_liberacao' }))
    }
    if (!col.fields.getByName('periodo_inicio')) {
      col.fields.add(new DateField({ name: 'periodo_inicio' }))
    }
    if (!col.fields.getByName('periodo_fim')) {
      col.fields.add(new DateField({ name: 'periodo_fim' }))
    }

    col.addIndex('idx_colab_data_lib', false, 'data_liberacao', '')

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('colaboradores')

    col.fields.removeByName('data_liberacao')
    col.fields.removeByName('periodo_inicio')
    col.fields.removeByName('periodo_fim')
    col.removeIndex('idx_colab_data_lib')

    app.save(col)
  },
)
