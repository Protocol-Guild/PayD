-- Migration 021: Add persistent sort ordering for employees
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS sort_order INTEGER;

WITH ordered_employees AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id
      ORDER BY created_at DESC, id DESC
    ) AS new_sort_order
  FROM employees
  WHERE deleted_at IS NULL
)
UPDATE employees e
SET sort_order = ordered_employees.new_sort_order
FROM ordered_employees
WHERE e.id = ordered_employees.id
  AND e.sort_order IS NULL;

ALTER TABLE employees
ALTER COLUMN sort_order SET DEFAULT 0;

UPDATE employees
SET sort_order = 0
WHERE sort_order IS NULL;

CREATE INDEX IF NOT EXISTS idx_employees_org_sort_order
ON employees (organization_id, sort_order, created_at DESC);
