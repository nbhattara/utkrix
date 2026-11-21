-- Add isApproved and approvedAt fields to users table
ALTER TABLE users ADD COLUMN is_approved BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN approved_at DATETIME NULL;
