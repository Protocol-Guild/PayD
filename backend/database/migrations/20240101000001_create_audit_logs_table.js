exports.up = function(knex) {
  return knex.schema.createTable('audit_logs', (table) => {
    table.string('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.timestamp('timestamp').notNullable().defaultTo(knex.fn.now());
    table.string('method').notNullable();
    table.string('path').notNullable();
    table.string('ip').notNullable();
    table.string('userAgent');
    table.integer('statusCode').notNullable();
    table.integer('duration').notNullable();
    table.text('body');
    table.text('query');
    table.text('params');
    table.string('user');
    table.string('tenantId');
    
    // Indexes for performance
    table.index(['timestamp']);
    table.index(['tenantId']);
    table.index(['user']);
    table.index(['method', 'path']);
    table.index(['statusCode']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('audit_logs');
};
