migrate(
  (app) => {
    // Delete all pagamentos records that reference colaboradores with referencia = 15
    app
      .db()
      .newQuery(
        `DELETE FROM pagamentos WHERE colaborador_id IN (SELECT id FROM colaboradores WHERE referencia = 15)`,
      )
      .execute()

    // Delete all colaboradores records where referencia = 15
    app.db().newQuery(`DELETE FROM colaboradores WHERE referencia = 15`).execute()
  },
  (app) => {
    // Irreversible migration - deleted data cannot be restored
  },
)
