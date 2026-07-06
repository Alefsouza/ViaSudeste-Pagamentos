migrate(
  (app) => {
    app
      .db()
      .newQuery(
        `DELETE FROM pagamentos WHERE colaborador_id IN (SELECT id FROM colaboradores WHERE referencia = 15)`,
      )
      .execute()

    app.db().newQuery(`DELETE FROM colaboradores WHERE referencia = 15`).execute()
  },
  (app) => {
    // Irreversible migration - deleted data cannot be restored
  },
)
