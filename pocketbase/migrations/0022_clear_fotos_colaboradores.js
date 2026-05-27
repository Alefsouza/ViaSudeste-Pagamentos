migrate(
  (app) => {
    app.db().newQuery('DELETE FROM fotos_colaboradores').execute()
  },
  (app) => {
    // down not possible
  },
)
