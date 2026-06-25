migrate(
  (app) => {
    try {
      const record = app.findFirstRecordByData('app_settings', 'name', 'login_background')
      const file = $filesystem.fileFromURL('https://img.usecurling.com/p/1920/1080?q=buses', 15)
      record.set('file', file)
      record.set('value', '')
      app.save(record)
    } catch (err) {
      console.log('Failed to update login_background: ' + err.message)
    }
  },
  (app) => {
    try {
      const record = app.findFirstRecordByData('app_settings', 'name', 'login_background')
      record.set('file', null)
      record.set('value', 'https://img.usecurling.com/p/1920/1080?q=electric%20bus')
      app.save(record)
    } catch (_) {}
  },
)
