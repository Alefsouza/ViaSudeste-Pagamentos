migrate(
  (app) => {
    const collection = new Collection({
      name: 'app_settings',
      type: 'base',
      listRule: '',
      viewRule: '',
      createRule: null,
      updateRule: "@request.auth.tipo_usuario = 'Administrador'",
      deleteRule: null,
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'value', type: 'text', required: false },
        { name: 'file', type: 'file', required: false, maxSelect: 1, maxSize: 5242880 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_app_settings_name ON app_settings (name)'],
    })
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('app_settings')
    app.delete(collection)
  },
)
