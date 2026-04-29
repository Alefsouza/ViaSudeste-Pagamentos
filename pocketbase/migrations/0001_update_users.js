migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.fields.add(
      new SelectField({
        name: 'tipo_usuario',
        values: ['gestor', 'boca_de_caixa'],
        maxSelect: 1,
        required: false,
      }),
    )
    app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.fields.removeByName('tipo_usuario')
    app.save(users)
  },
)
