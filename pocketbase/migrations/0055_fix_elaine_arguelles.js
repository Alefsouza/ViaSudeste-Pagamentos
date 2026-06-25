migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    let user

    try {
      user = app.findAuthRecordByEmail('users', 'elaine.arguelles@viasudeste.com')
    } catch (_) {
      user = new Record(users)
      user.setEmail('elaine.arguelles@viasudeste.com')
      user.set('name', 'Elaine Arguelles')
    }

    user.setPassword('via@1234')
    user.set('garagem', 'Sapopemba')
    user.set('tipo_usuario', 'recebedoria')
    user.setVerified(true)

    app.save(user)
  },
  (app) => {
    try {
      const user = app.findAuthRecordByEmail('users', 'elaine.arguelles@viasudeste.com')
      user.setPassword('Skip@Pass')
      app.save(user)
    } catch (_) {}
  },
)
