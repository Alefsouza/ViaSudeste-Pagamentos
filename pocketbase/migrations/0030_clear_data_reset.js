migrate(
  (app) => {
    app.db().newQuery('DELETE FROM pagamentos').execute()
    app.db().newQuery('DELETE FROM colaboradores').execute()
  },
  (app) => {
    // Cannot restore deleted data
  },
)
