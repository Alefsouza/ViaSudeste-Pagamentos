migrate(
  (app) => {
    app
      .db()
      .newQuery(
        `DELETE FROM pagamentos WHERE colaborador_id IN (SELECT id FROM colaboradores WHERE referencia = 16)`,
      )
      .execute()

    app.db().newQuery(`DELETE FROM colaboradores WHERE referencia = 16`).execute()

    console.log('Migration 0090: All records with referencia = 16 purged successfully.')
  },
  (app) => {
    // Irreversible migration - deleted data cannot be restored
  },
)
