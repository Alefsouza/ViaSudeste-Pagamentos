migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('app_settings')
    try {
      app.findFirstRecordByData('app_settings', 'name', 'login_background')
      return
    } catch (_) {
      const record = new Record(col)
      record.set('name', 'login_background')
      record.set('value', 'https://img.usecurling.com/p/1920/1080?q=electric%20bus')
      app.save(record)
    }
  },
  (app) => {
    try {
      const record = app.findFirstRecordByData('app_settings', 'name', 'login_background')
      app.delete(record)
    } catch (_) {}
  },
)
