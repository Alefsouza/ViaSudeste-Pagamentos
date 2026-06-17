migrate(
  (app) => {
    try {
      const user = app.findAuthRecordByEmail('_pb_users_auth_', 'financeiro@viasudeste.com')
      user.set('tipo_usuario', 'recebedoria')
      app.save(user)
    } catch (_) {}
  },
  (app) => {
    try {
      const user = app.findAuthRecordByEmail('_pb_users_auth_', 'financeiro@viasudeste.com')
      user.set('tipo_usuario', 'Administrador')
      app.save(user)
    } catch (_) {}
  },
)
