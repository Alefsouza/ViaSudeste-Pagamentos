migrate(
  (app) => {
    try {
      const user = app.findRecordById('users', 'skoa5d0rrmv3quw')
      if (user) {
        user.set('tipo_usuario', 'recebedoria')
        app.save(user)
      }
    } catch (err) {
      // Record might not exist in environments other than prod, silently ignore
    }
  },
  (app) => {
    try {
      const user = app.findRecordById('users', 'skoa5d0rrmv3quw')
      if (user) {
        user.set('tipo_usuario', '')
        app.save(user)
      }
    } catch (err) {
      // Ignore on revert
    }
  },
)
