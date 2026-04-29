migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const tipoUsuario = users.fields.getByName('tipo_usuario')
    if (tipoUsuario) {
      tipoUsuario.values = ['Administrador', 'recebedoria']
      app.save(users)
    }
  },
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const tipoUsuario = users.fields.getByName('tipo_usuario')
    if (tipoUsuario) {
      tipoUsuario.values = ['gestor', 'boca_de_caixa']
      app.save(users)
    }
  },
)
