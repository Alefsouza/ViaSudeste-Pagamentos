migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('app_settings')
    let record
    try {
      record = app.findFirstRecordByData('app_settings', 'name', 'login_background')
    } catch (_) {
      record = new Record(col)
      record.set('name', 'login_background')
    }

    try {
      // Seed with a high-quality image of electric buses
      const file = $filesystem.fileFromURL(
        'https://img.usecurling.com/p/1920/1080?q=electric%20buses',
        15,
      )
      record.set('file', file)
      app.save(record)
    } catch (err) {
      console.log('Failed to seed login background:', err.message)
    }
  },
  (app) => {
    try {
      const record = app.findFirstRecordByData('app_settings', 'name', 'login_background')
      // Revert to the previous image
      const file = $filesystem.fileFromURL(
        'https://img.usecurling.com/p/1920/1080?q=sao%20paulo%20electric%20bus',
        15,
      )
      record.set('file', file)
      app.save(record)
    } catch (_) {}
  },
)
