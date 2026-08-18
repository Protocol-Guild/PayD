-- Organization profile fields for the Settings page.
-- Contact info is optional and managed by org admins via the Settings UI.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(50);
