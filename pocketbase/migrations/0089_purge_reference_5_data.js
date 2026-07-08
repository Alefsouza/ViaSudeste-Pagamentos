migrate(
  (app) => {
    app
      .db()
      .newQuery(
        `DELETE FROM pagamentos WHERE colaborador_id IN (SELECT id FROM colaboradores WHERE referencia = 5)`,
      )
      .execute()

    app.db().newQuery(`DELETE FROM colaboradores WHERE referencia = 5`).execute()

    console.log('Migration 0089: All records with referencia = 5 purged successfully.')
  },
  (app) => {
    // Irreversible migration - deleted data cannot be restored
  },
)
