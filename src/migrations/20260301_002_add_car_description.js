exports.up = async function (knex) {
  const hasCars = await knex.schema.hasTable('cars');
  if (!hasCars) return;

  const hasDescription = await knex.schema.hasColumn('cars', 'description');
  if (!hasDescription) {
    await knex.schema.alterTable('cars', (table) => {
      table.text('description');
    });
  }
};

exports.down = async function (knex) {
  const hasCars = await knex.schema.hasTable('cars');
  if (!hasCars) return;

  const hasDescription = await knex.schema.hasColumn('cars', 'description');
  if (hasDescription) {
    await knex.schema.alterTable('cars', (table) => {
      table.dropColumn('description');
    });
  }
};
