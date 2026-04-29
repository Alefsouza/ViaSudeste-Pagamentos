migrate(
  (app) => {
    const collection = new Collection({
      name: 'colaboradores',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'registro', type: 'text', required: true },
        { name: 'nome', type: 'text', required: true },
        { name: 'valor_a_receber', type: 'number', required: true },
        {
          name: 'filial',
          type: 'select',
          values: ['Cursino', 'Sapopemba'],
          maxSelect: 1,
          required: true,
        },
        { name: 'foto', type: 'file', maxSelect: 1, mimeTypes: ['image/jpeg', 'image/png'] },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_colaboradores_registro ON colaboradores (registro)'],
    })
    app.save(collection)
  },
  (app) => {
    const collection = app.findCollectionByNameOrId('colaboradores')
    app.delete(collection)
  },
)
