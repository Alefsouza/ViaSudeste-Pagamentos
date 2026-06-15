migrate(
  (app) => {
    const collection = app.findCollectionByNameOrId('pagamentos')
    const field = collection.fields.getByName('status')
    if (field) {
      field.values = ['Confirmado', 'Pendente', 'Cancelado']
      app.save(collection)
    }
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('pagamentos')
    const field = collection.fields.getByName('status')
    if (field) {
      field.values = ['Confirmado', 'Pendente']
      app.save(collection)
    }
  },
)
