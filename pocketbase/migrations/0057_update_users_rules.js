migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    users.listRule =
      "id = @request.auth.id || @request.auth.tipo_usuario = 'Administrador' || @request.auth.tipo_usuario = 'recebedoria' || @request.auth.tipo_usuario = 'DP'"
    users.viewRule =
      "id = @request.auth.id || @request.auth.tipo_usuario = 'Administrador' || @request.auth.tipo_usuario = 'recebedoria' || @request.auth.tipo_usuario = 'DP'"
    app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    users.listRule = "id = @request.auth.id || @request.auth.tipo_usuario = 'Administrador'"
    users.viewRule = "id = @request.auth.id || @request.auth.tipo_usuario = 'Administrador'"
    app.save(users)
  },
)
