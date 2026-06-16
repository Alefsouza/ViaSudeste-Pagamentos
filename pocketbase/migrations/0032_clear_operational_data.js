migrate(
  (app) => {
    app.db().newQuery('DELETE FROM pagamentos').execute()
    app.db().newQuery('DELETE FROM colaboradores').execute()
  },
  (app) => {
    // Down migration is empty as data deletion is irreversible
  },
)
