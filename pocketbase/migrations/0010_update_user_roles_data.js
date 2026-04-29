migrate(
  (app) => {
    app
      .db()
      .newQuery("UPDATE users SET tipo_usuario = 'Administrador' WHERE tipo_usuario = 'gestor'")
      .execute()
    app
      .db()
      .newQuery(
        "UPDATE users SET tipo_usuario = 'recebedoria' WHERE tipo_usuario = 'boca_de_caixa'",
      )
      .execute()
  },
  (app) => {
    app
      .db()
      .newQuery("UPDATE users SET tipo_usuario = 'gestor' WHERE tipo_usuario = 'Administrador'")
      .execute()
    app
      .db()
      .newQuery(
        "UPDATE users SET tipo_usuario = 'boca_de_caixa' WHERE tipo_usuario = 'recebedoria'",
      )
      .execute()
  },
)
