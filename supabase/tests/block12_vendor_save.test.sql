-- ============================================================
-- Luma · pgTAP · Block 12: a vendor and its payment schedule save in one
-- step (0015 save_vendor)
-- Run with: supabase test db
--
-- The client used to save a vendor in three requests: upsert the vendor,
-- DELETE its payments, INSERT the new list. A failure after the delete
-- left the vendor with no schedule. save_vendor does all three in one
-- transaction, under the caller's own row-level security.
-- ============================================================

begin;
select plan(11);

create or replace function test_uuid(suffix text)
returns uuid
language sql immutable
as $$
  select ('00000000-0000-0000-0000-' || lpad(suffix, 12, '0'))::uuid;
$$;

-- fixtures, as postgres, before any role switch ------------------------
insert into auth.users (id, email, encrypted_password, email_confirmed_at)
values (test_uuid('121'), 'couple12@example.com', 'hashed', now()),
       (test_uuid('122'), 'stranger12@example.com', 'hashed', now());

insert into weddings (id, owner_id, slug, names, date)
values (test_uuid('1200'), test_uuid('121'), 'b12-couple', 'Vendor & Couple', now() + interval '1 year'),
       (test_uuid('1201'), test_uuid('122'), 'b12-stranger', 'Other & Couple', now() + interval '1 year');
insert into wedding_members (wedding_id, user_id, role)
values (test_uuid('1200'), test_uuid('121'), 'owner'), (test_uuid('1201'), test_uuid('122'), 'owner');

-- the stranger's vendor, which the couple must not be able to overwrite
insert into vendors (id, wedding_id, category, company)
values (test_uuid('1290'), test_uuid('1201'), 'Florist', 'Stranger Flowers');

select has_function('public', 'save_vendor', array['uuid', 'jsonb', 'jsonb'], 'save_vendor(uuid, jsonb, jsonb) exists');

-- the couple saves a vendor with a schedule -------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000121", "role": "authenticated"}';

select lives_ok(
  $$ select save_vendor(
       '00000000-0000-0000-0000-000000001200'::uuid,
       '{"id": "00000000-0000-0000-0000-000000001210", "category": "Venue", "company": "The Glasshouse",
         "contact": "Ana", "email": "ana@example.com", "phone": "", "price": 12000, "status": "Booked",
         "contract": true, "notes": "", "budget_id": null}'::jsonb,
       '[{"label": "Deposit", "amount": 3000, "due": "2027-01-10", "paid": true},
         {"label": "Second", "amount": 4000, "due": "2027-04-10", "paid": false},
         {"label": "Final", "amount": 5000, "due": "2027-07-10", "paid": false}]'::jsonb) $$,
  'a member saves a vendor and its schedule'
);
select is(
  (select count(*)::int from vendor_payments where vendor_id = '00000000-0000-0000-0000-000000001210'), 3,
  'all three payments are stored'
);
select is(
  (select array_agg(label order by sort) from vendor_payments where vendor_id = '00000000-0000-0000-0000-000000001210'),
  array['Deposit', 'Second', 'Final'],
  'in the order given'
);

-- saving again replaces the schedule ---------------------------------------
select lives_ok(
  $$ select save_vendor(
       '00000000-0000-0000-0000-000000001200'::uuid,
       '{"id": "00000000-0000-0000-0000-000000001210", "category": "Venue", "company": "The Glasshouse",
         "contact": "Ana", "email": "ana@example.com", "phone": "", "price": 12000, "status": "Booked",
         "contract": true, "notes": "", "budget_id": null}'::jsonb,
       '[{"label": "Deposit", "amount": 3000, "due": "2027-01-10", "paid": true},
         {"label": "Balance", "amount": 9000, "due": "2027-07-10", "paid": false}]'::jsonb) $$,
  'saving an edited schedule works'
);
select is(
  (select count(*)::int from vendor_payments where vendor_id = '00000000-0000-0000-0000-000000001210'), 2,
  'the old schedule is replaced, not added to'
);

-- THE POINT: a save that fails part-way changes nothing -------------------
select throws_ok(
  $$ select save_vendor(
       '00000000-0000-0000-0000-000000001200'::uuid,
       '{"id": "00000000-0000-0000-0000-000000001210", "category": "Venue", "company": "The Glasshouse",
         "contact": "Ana", "email": "ana@example.com", "phone": "", "price": 12000, "status": "Booked",
         "contract": true, "notes": "", "budget_id": null}'::jsonb,
       '[{"label": "Deposit", "amount": 3000, "due": "2027-01-10", "paid": true},
         {"label": null, "amount": 1, "due": "", "paid": false}]'::jsonb) $$,
  '23502', null,
  'a payment that can''t be stored fails the whole save'
);
select is(
  (select array_agg(label order by sort) from vendor_payments where vendor_id = '00000000-0000-0000-0000-000000001210'),
  array['Deposit', 'Balance'],
  'and the previous schedule survives intact'
);

-- nobody else's vendor ------------------------------------------------------
select throws_ok(
  $$ select save_vendor(
       '00000000-0000-0000-0000-000000001200'::uuid,
       '{"id": "00000000-0000-0000-0000-000000001290", "category": "Florist", "company": "Hijacked",
         "contact": "", "email": "", "phone": "", "price": 0, "status": "Inquiry",
         "contract": false, "notes": "", "budget_id": null}'::jsonb,
       '[]'::jsonb) $$,
  '42501', null,
  'a member can''t overwrite another wedding''s vendor through it'
);

set local role postgres;
select is(
  (select company from vendors where id = test_uuid('1290')), 'Stranger Flowers',
  'the other wedding''s vendor is unchanged'
);

-- signed-out visitors can't call it at all -----------------------------------
select ok(
  not has_function_privilege('anon', 'public.save_vendor(uuid, jsonb, jsonb)', 'execute'),
  'anon cannot execute save_vendor'
);

select * from finish();
rollback;
