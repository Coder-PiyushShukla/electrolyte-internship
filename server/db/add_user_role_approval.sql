-- ============================================================
-- Fix: users table is missing columns required by auth.controller.js
--      (is_approved, role) - causes "Internal server error" on
--      login/register because those queries fail against the
--      original init.sql schema.
-- Run: psql -U postgres -d pcb_tracker -f add_user_role_approval.sql
-- ============================================================

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_approved BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';

-- Make sure any pre-existing admin row (from init.sql's placeholder insert)
-- is approved and has the admin role, so it isn't locked out.
UPDATE users SET is_approved = true, role = 'admin' WHERE username = 'admin';
