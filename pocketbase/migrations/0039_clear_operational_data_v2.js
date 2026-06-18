migrate(
  (app) => {
    const pagamentos = app.findCollectionByNameOrId('pagamentos')
    app.truncateCollection(pagamentos)

    const colaboradores = app.findCollectionByNameOrId('colaboradores')
    app.truncateCollection(colaboradores)
  },
  (app) => {
    // Irreversible migration - deleted data cannot be restored
  },
)
