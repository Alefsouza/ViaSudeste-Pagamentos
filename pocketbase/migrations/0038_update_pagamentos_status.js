migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('pagamentos')
    const field = collection.fields.getByName('status')
    if (field) {
      field.values = ['Confirmado', 'Pendente', 'Cancelado', 'Agendado', 'Bloqueado']
      app.save(collection)
    }
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('pagamentos')
    const field = collection.fields.getByName('status')
    if (field) {
      field.values = ['Confirmado', 'Pendente', 'Cancelado', 'Agendado']
      app.save(collection)
    }
  },
)
