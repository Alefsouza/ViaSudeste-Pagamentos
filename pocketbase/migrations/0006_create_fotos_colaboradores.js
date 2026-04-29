migrate(
  (app) => {
    const collection = new Collection({
      name: 'fotos_colaboradores',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'registro', type: 'text', required: true },
        {
          name: 'filial',
          type: 'select',
          required: true,
          values: ['Cursino', 'Sapopemba'],
          maxSelect: 1,
        },
        {
          name: 'foto',
          type: 'file',
          required: true,
          maxSelect: 1,
          maxSize: 5242880,
          mimeTypes: ['image/jpeg', 'image/png'],
        },
        { name: 'foto_url', type: 'text' },
        { name: 'data_upload', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_fotos_colaboradores_registro ON fotos_colaboradores (registro)',
      ],
    })
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('fotos_colaboradores')
    app.delete(collection)
  },
)
