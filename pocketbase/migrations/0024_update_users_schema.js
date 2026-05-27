migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')

    const tipoUsuarioField = users.fields.getByName('tipo_usuario')
    if (tipoUsuarioField) {
      tipoUsuarioField.values = ['Administrador', 'recebedoria', 'DP']
    }

    if (!users.fields.getByName('garagem')) {
      users.fields.add(
        new TextField({
          name: 'garagem',
          required: false,
        }),
      )
    }

    app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users')

    const tipoUsuarioField = users.fields.getByName('tipo_usuario')
    if (tipoUsuarioField) {
      tipoUsuarioField.values = ['Administrador', 'recebedoria']
    }

    if (users.fields.getByName('garagem')) {
      users.fields.removeByName('garagem')
    }

    app.save(users)
  },
)
