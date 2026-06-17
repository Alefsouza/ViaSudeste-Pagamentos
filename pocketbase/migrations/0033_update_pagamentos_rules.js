migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('pagamentos')
    col.createRule =
      "@request.auth.id != '' && (@request.auth.tipo_usuario = 'Administrador' || @request.auth.tipo_usuario = 'recebedoria')"
    col.updateRule =
      "@request.auth.id != '' && (@request.auth.tipo_usuario = 'Administrador' || @request.auth.tipo_usuario = 'recebedoria')"
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('pagamentos')
    col.createRule = "@request.auth.id != ''"
    col.updateRule = "@request.auth.id != ''"
    app.save(col)
  },
)
