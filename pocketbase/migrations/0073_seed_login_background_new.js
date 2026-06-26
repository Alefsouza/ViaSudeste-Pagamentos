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
      // Try fetching the local asset from the preview deployment URL to seed the database
      const file = $filesystem.fileFromURL(
        'https://tela-de-login-dc255--preview.goskip.app/src/assets/1-2ad70.jpeg',
        15,
      )
      record.set('file', file)
      app.save(record)
    } catch (err) {
      console.log('Failed to seed local login background:', err.message)
    }
  },
  (app) => {
    // Revert logic is skipped as keeping the latest image is preferred
  },
)
