migrate(
  (app) => {
    // Find all users where the garage contains "sapopemba" (case-insensitive)
    const users = app.findRecordsByFilter('users', "garagem ~ 'sapopemba'", '', 1000, 0)

    for (const user of users) {
      // Standardize 'garagem' value
      user.set('garagem', 'Sapopemba')

      // Assign role if missing to prevent logic errors during post-login redirection
      if (!user.get('tipo_usuario')) {
        user.set('tipo_usuario', 'recebedoria')
      }

      // Ensure email is verified so they can log in
      if (!user.getBool('verified')) {
        user.setVerified(true)
      }

      // Provide a standardized temporary password for access recovery
      user.setPassword('Skip@Pass')

      // Save applies the changes and runs validations
      app.save(user)
    }
  },
  (app) => {
    // Irreversible migration - specific data cleanup
  },
)
