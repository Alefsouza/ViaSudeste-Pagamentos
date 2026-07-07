migrate(
  (app) => {
    // Delete all pagamentos records where referencia = 15
    // (pagamentos has its own referencia field)
    app.db().newQuery(`DELETE FROM pagamentos WHERE referencia = 15`).execute()

    // Also delete pagamentos linked to colaboradores with referencia = 15
    // (safety net for records where pagamentos.referencia was not set)
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
