migrate(
  (app) => {
    // Migration 0087: Neutralize data-level blocks from migrations 0082, 0083, and 0084
    // Those migrations permanently deleted records with referencia = 15 from
    // colaboradores and pagamentos collections. This migration ensures no
    // configuration or automated process prevents the reuse of Reference 15.
    //
    // The code-level blocks have been removed from import_colaboradores.js
    // and import_pagamentos.js hooks. This migration serves as a marker
    // that Reference 15 is now a valid and active reference number.
    //
    // No data restoration is possible for previously deleted records,
    // but new records with referencia = 15 can now be imported and processed
    // without any restrictions.

    // Ensure no app_settings entry blocks Reference 15
    try {
      var settings = app.findRecordsByFilter('app_settings', "name ~ 'referencia_15'", '', 100, 0)
      for (var i = 0; i < settings.length; i++) {
        app.delete(settings[i])
      }
    } catch (err) {
      // No settings to clean up — safe to continue
    }

    console.log('Migration 0087: Reference 15 blocks neutralized successfully.')
  },
  (app) => {
    // No-op: removing the neutralization would re-enable blocks that no longer
    // exist in code. This migration is not reversible in a meaningful way.
  },
)
