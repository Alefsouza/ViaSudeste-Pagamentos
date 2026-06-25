migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    let user

    try {
      user = app.findAuthRecordByEmail('users', 'rafael.rodrigues@viasudeste.com')
    } catch (_) {
      user = new Record(users)
      user.setEmail('rafael.rodrigues@viasudeste.com')
      user.set('name', 'Rafael Rodrigues')
    }

    user.setPassword('via@1234')
    user.set('garagem', 'Sapopemba')
    user.set('tipo_usuario', 'Administrador')
    user.setVerified(true)

    app.save(user)
  },
  (app) => {
    try {
      const user = app.findAuthRecordByEmail('users', 'rafael.rodrigues@viasudeste.com')
      user.setPassword('Skip@Pass')
      app.save(user)
    } catch (_) {}
  },
)
