migrate(
  (app) => {
    try {
      const record = app.findFirstRecordByData('app_settings', 'name', 'login_background')
      // Update to use the new primary background source from the public folder
      record.set('value', '/login-background.png')
      // Clear the file field to ensure the new local value takes precedence
      record.set('file', null)
      app.save(record)
    } catch (err) {
      console.log('Failed to update login_background: ' + err.message)
    }
  },
  (app) => {
    try {
      const record = app.findFirstRecordByData('app_settings', 'name', 'login_background')
      record.set('value', '')
      app.save(record)
    } catch (_) {}
  },
)
