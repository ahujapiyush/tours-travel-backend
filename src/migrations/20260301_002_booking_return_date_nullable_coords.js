/**
 * Add return_date to bookings and make lat/lng columns nullable
 * so guest bookings (address-only, no coordinates) can be created.
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('bookings', (t) => {
    t.timestamp('return_date').nullable();
  });

  // Make coordinate columns nullable (they were NOT NULL in the original migration)
  await knex.raw('ALTER TABLE bookings ALTER COLUMN pickup_lat DROP NOT NULL');
  await knex.raw('ALTER TABLE bookings ALTER COLUMN pickup_lng DROP NOT NULL');
  await knex.raw('ALTER TABLE bookings ALTER COLUMN drop_lat DROP NOT NULL');
  await knex.raw('ALTER TABLE bookings ALTER COLUMN drop_lng DROP NOT NULL');
};

exports.down = async function (knex) {
  await knex.schema.alterTable('bookings', (t) => {
    t.dropColumn('return_date');
  });

  await knex.raw('ALTER TABLE bookings ALTER COLUMN pickup_lat SET NOT NULL');
  await knex.raw('ALTER TABLE bookings ALTER COLUMN pickup_lng SET NOT NULL');
  await knex.raw('ALTER TABLE bookings ALTER COLUMN drop_lat SET NOT NULL');
  await knex.raw('ALTER TABLE bookings ALTER COLUMN drop_lng SET NOT NULL');
};
