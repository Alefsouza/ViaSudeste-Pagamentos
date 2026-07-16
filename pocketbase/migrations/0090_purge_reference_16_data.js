migrate(
  (app) => {
    // Check if any colaboradores with referencia = 16 exist (idempotency guard)
    let count = 0
    try {
      const result = app
        .db()
        .newQuery('SELECT COUNT(*) as cnt FROM colaboradores WHERE referencia = 16')
        .one()
      count = result ? parseInt(result.cnt, 10) : 0
    } catch (_) {
      count = 0
    }

    if (count === 0) {
      console.log('Migration 0090: No records with referencia = 16 found. Skipping.')
      return
    }

    // Delete all pagamentos records linked to colaboradores with referencia = 16
    // (pagamentos has no referencia column; join via colaborador_id)
    app
      .db()
      .newQuery(
        `DELETE FROM pagamentos WHERE colaborador_id IN (SELECT id FROM colaboradores WHERE referencia = 16)`,
      )
      .execute()

    // Delete all colaboradores records where referencia = 16
    app.db().newQuery(`DELETE FROM colaboradores WHERE referencia = 16`).execute()

    console.log('Migration 0090: All records with referencia = 16 purged successfully.')
  },
  (app) => {
    // Irreversible migration - deleted data cannot be restored
  },
)
