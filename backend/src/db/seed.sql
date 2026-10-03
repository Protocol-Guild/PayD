-- Synthetic staging/search data. Resolve generated IDs rather than assuming
-- sequences start at 1: PostgreSQL sequences also advance on rolled-back seeds.
DO $$
DECLARE
  seed_organization INTEGER;
BEGIN
  SELECT id INTO seed_organization FROM organizations
  WHERE name = 'Acme Corp' ORDER BY id LIMIT 1;
  IF seed_organization IS NULL THEN
    INSERT INTO organizations (name) VALUES ('Acme Corp')
      RETURNING id INTO seed_organization;
  END IF;

  INSERT INTO employees (organization_id, first_name, last_name, email, wallet_address, status, position, department)
  VALUES
    (seed_organization, 'John', 'Doe', 'john.doe@acme.com', 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX1', 'active', 'Software Engineer', 'Engineering'),
    (seed_organization, 'Jane', 'Smith', 'jane.smith@acme.com', 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX2', 'active', 'Product Manager', 'Product'),
    (seed_organization, 'Bob', 'Johnson', 'bob.johnson@acme.com', 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX3', 'inactive', 'Designer', 'Design'),
    (seed_organization, 'Alice', 'Williams', 'alice.williams@acme.com', 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX4', 'active', 'DevOps Engineer', 'Engineering'),
    (seed_organization, 'Charlie', 'Brown', 'charlie.brown@acme.com', 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX5', 'pending', 'Marketing Manager', 'Marketing')
  ON CONFLICT (email) DO NOTHING;

  IF (SELECT count(*) FROM employees WHERE organization_id = seed_organization
      AND email IN ('john.doe@acme.com', 'jane.smith@acme.com', 'bob.johnson@acme.com', 'alice.williams@acme.com', 'charlie.brown@acme.com')) <> 5 THEN
    RAISE EXCEPTION 'Staging seed email already belongs to another organization';
  END IF;

  -- Fixed 64-character synthetic hashes fit the real transaction schema.
  INSERT INTO transactions (organization_id, employee_id, tx_hash, amount, asset_code, status, transaction_type)
  SELECT seed_organization, employee.id, repeat(sample.hash_digit, 64), sample.amount,
         sample.asset_code, sample.status, sample.transaction_type
  FROM (VALUES
    ('john.doe@acme.com', '1', 1000.50, 'USDC', 'completed', 'payment'),
    ('jane.smith@acme.com', '2', 2500.75, 'USDC', 'completed', 'payment'),
    ('john.doe@acme.com', '3', 500.00, 'USDC', 'pending', 'payment'),
    ('bob.johnson@acme.com', '4', 750.25, 'XLM', 'failed', 'payment'),
    ('alice.williams@acme.com', '5', 3000.00, 'USDC', 'completed', 'bonus')
  ) AS sample(email, hash_digit, amount, asset_code, status, transaction_type)
  JOIN employees employee ON employee.email = sample.email
    AND employee.organization_id = seed_organization
  ON CONFLICT (tx_hash) DO NOTHING;

  INSERT INTO tax_rules (organization_id, name, type, value, description, priority)
  SELECT seed_organization, sample.name, sample.type, sample.value, sample.description, sample.priority
  FROM (VALUES
    ('Federal Income Tax', 'percentage', 22.0000000, 'Standard federal income tax rate', 0),
    ('State Tax', 'percentage', 5.0000000, 'State income tax', 1),
    ('Health Insurance', 'fixed', 150.0000000, 'Monthly health insurance deduction', 2)
  ) AS sample(name, type, value, description, priority)
  WHERE NOT EXISTS (SELECT 1 FROM tax_rules existing
    WHERE existing.organization_id = seed_organization AND existing.name = sample.name);
END;
$$;
