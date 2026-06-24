migrate(
  (app) => {
    // Delete related pagamentos first to prevent orphaned data
    app
      .db()
      .newQuery(
        `DELETE FROM pagamentos WHERE colaborador_id IN (SELECT id FROM colaboradores WHERE referencia = 10)`,
      )
      .execute()

    // Delete the colaboradores with specific reference
    app.db().newQuery(`DELETE FROM colaboradores WHERE referencia = 10`).execute()
  },
  (app) => {
    // Irreversible migration - deleted data cannot be restored
  },
)
