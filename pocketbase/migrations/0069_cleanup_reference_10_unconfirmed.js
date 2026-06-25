migrate(
  (app) => {
    // Delete payments for collaborators with referencia = 10
    // that DO NOT have any payment with status = 'Confirmado'
    app
      .db()
      .newQuery(
        `
        DELETE FROM pagamentos 
        WHERE colaborador_id IN (
            SELECT id FROM colaboradores 
            WHERE referencia = 10 
            AND id NOT IN (
                SELECT colaborador_id FROM pagamentos 
                WHERE status = 'Confirmado' 
                AND colaborador_id IS NOT NULL
            )
        )
        `,
      )
      .execute()

    // Delete the collaborators with referencia = 10
    // that DO NOT have any payment with status = 'Confirmado'
    app
      .db()
      .newQuery(
        `
        DELETE FROM colaboradores 
        WHERE referencia = 10 
        AND id NOT IN (
            SELECT colaborador_id FROM pagamentos 
            WHERE status = 'Confirmado' 
            AND colaborador_id IS NOT NULL
        )
        `,
      )
      .execute()
  },
  (app) => {
    // Irreversible migration - deleted data cannot be restored
  },
)
