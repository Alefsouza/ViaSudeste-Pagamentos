migrate(
  (app) => {
    // Delete related pagamentos first to prevent orphaned data
    app
      .db()
      .newQuery(
        `DELETE FROM pagamentos WHERE colaborador_id IN (SELECT id FROM colaboradores WHERE referencia IN (10, 11, 12))`,
      )
      .execute()

    // Delete the colaboradores with specific references
    app.db().newQuery(`DELETE FROM colaboradores WHERE referencia IN (10, 11, 12)`).execute()
  },
  (app) => {
    // Irreversible migration - deleted data cannot be restored
  },
)
