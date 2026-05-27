migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    users.listRule = "id = @request.auth.id || @request.auth.tipo_usuario = 'Administrador'"
    users.viewRule = "id = @request.auth.id || @request.auth.tipo_usuario = 'Administrador'"
    users.updateRule = "id = @request.auth.id || @request.auth.tipo_usuario = 'Administrador'"
    users.deleteRule = "@request.auth.tipo_usuario = 'Administrador'"
    app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    users.listRule = 'id = @request.auth.id'
    users.viewRule = 'id = @request.auth.id'
    users.updateRule = 'id = @request.auth.id'
    users.deleteRule = 'id = @request.auth.id'
    app.save(users)
  },
)
