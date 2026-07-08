migrate(
  (app) => {
    // Delete all pagamentos records linked to colaboradores with referencia = 15
    // (pagamentos has no referencia column; join via colaborador_id)
    app
      .db()
      .newQuery(
        `DELETE FROM pagamentos WHERE colaborador_id IN (SELECT id FROM colaboradores WHERE referencia = 15)`,
      )
      .execute()

    // Delete all colaboradores records where referencia = 15
    app.db().newQuery(`DELETE FROM colaboradores WHERE referencia = 15`).execute()

    console.log('Migration 0088: All records with referencia = 15 purged successfully.')
  },
  (app) => {
    // Irreversible migration - deleted data cannot be restored
  },
)
