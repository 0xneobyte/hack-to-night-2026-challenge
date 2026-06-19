-- Nova Bank — Development seed data
--
-- Run ONLY in local dev / staging. Never run against production.
-- Usage:
--   supabase db reset --linked   # applies migrations + seed
--   # or paste into Supabase SQL editor manually
--
-- NOTE: This file references real auth.users IDs. For local dev you
-- must first create the users via Supabase Auth (sign-up flow or
-- admin API), then replace the UUIDs below with the actual values.
-- For an empty dev database, simply skip this file.

-- Example structure (commented out by default):
-- INSERT INTO public.profiles (id, full_name, nic, role) VALUES
--   ('00000000-0000-0000-0000-000000000001', 'Dilara Perera',   '200112345678', 'customer'),
--   ('00000000-0000-0000-0000-000000000002', 'Kasun Wickramanayake', '199812345678', 'customer'),
--   ('00000000-0000-0000-0000-000000000003', 'Platform Administrator', '000000000000', 'admin')
-- ON CONFLICT (id) DO NOTHING;

-- INSERT INTO public.accounts (user_id, account_number, account_name, balance, pin_hash) VALUES
--   ('00000000-0000-0000-0000-000000000001', '1000003423', 'Dilara Savings',   100000.00, crypt('1234', gen_salt('bf'))),
--   ('00000000-0000-0000-0000-000000000001', '1000004876', 'Dilara Expenses',   42000.00, crypt('1234', gen_salt('bf'))),
--   ('00000000-0000-0000-0000-000000000002', '2000006754', 'Kasun Current',      9870.00, crypt('0000', gen_salt('bf')))
-- ON CONFLICT (account_number) DO NOTHING;

-- INSERT INTO public.transactions (from_account, to_account, amount, description, created_by) VALUES
--   ('1000003423', '2000006754', 4500.00, 'Lunch money', '00000000-0000-0000-0000-000000000001'),
--   ('1000004876', '1000003423', 1000.00, 'Top-up',      '00000000-0000-0000-0000-000000000001')
-- ON CONFLICT DO NOTHING;
