migrate(
  (app) => {
    // 1. Ensure public read rules for app_settings
    try {
      const col = app.findCollectionByNameOrId('app_settings')
      col.listRule = ''
      col.viewRule = ''
      app.save(col)
    } catch (err) {
      console.log('Failed to update app_settings rules: ' + err.message)
    }

    // 2. Upload the electric bus image
    try {
      const record = app.findFirstRecordByData('app_settings', 'name', 'login_background')
      // Using an electric bus placeholder to represent the user-provided São Paulo buses image
      const file = $filesystem.fileFromURL(
        'https://img.usecurling.com/p/1920/1080?q=electric%20bus',
        60,
      )
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
      record.set('value', '/login-background.png')
      app.save(record)
    } catch (_) {}
  },
)
