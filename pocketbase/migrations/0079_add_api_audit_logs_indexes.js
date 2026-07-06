migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('api_audit_logs')
    col.addIndex('idx_api_audit_logs_endpoint', false, 'endpoint', '')
    col.addIndex('idx_api_audit_logs_user', false, 'user', '')
    col.addIndex('idx_api_audit_logs_created', false, 'created', '')
    col.addIndex('idx_api_audit_logs_user_created', false, 'user,created', '')
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('api_audit_logs')
    col.removeIndex('idx_api_audit_logs_endpoint')
    col.removeIndex('idx_api_audit_logs_user')
    col.removeIndex('idx_api_audit_logs_created')
    col.removeIndex('idx_api_audit_logs_user_created')
    app.save(col)
  },
)
