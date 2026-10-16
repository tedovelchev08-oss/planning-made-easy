-- ============================================================
-- Luma · pgTAP · Block 14: deleting an account keeps the payment record
-- (0017 purchases.wedding_id → on delete set null)
-- Run with: supabase test db
--
-- Deleting an owner's account deletes their wedding (and everything in
-- it). purchases.wedding_id used to cascade too, so Luma's own record of a
-- payment vanished with the wedding, although accounting law can require
-- keeping it. The row now stays, with wedding_id and user_id cleared.
-- ============================================================

begin;
select plan(6);

create or replace function test_uuid(suffix text)
returns uuid
language sql immutable
as $$
  select ('00000000-0000-0000-0000-' || lpad(suffix, 12, '0'))::uuid;
$$;

-- fixtures, as postgres ---------------------------------------------------
insert into auth.users (id, email, encrypted_password, email_confirmed_at)
values (test_uuid('141'), 'owner14@example.com', 'hashed', now()),
       (test_uuid('142'), 'partner14@example.com', 'hashed', now());

insert into weddings (id, owner_id, slug, names, date, plan)
values (test_uuid('1400'), test_uuid('141'), 'b14-wedding', 'Delete & Me', now() + interval '1 year', 'celebration');
insert into wedding_members (wedding_id, user_id, role)
values (test_uuid('1400'), test_uuid('141'), 'owner'), (test_uuid('1400'), test_uuid('142'), 'partner');
insert into guests (wedding_id, name) values (test_uuid('1400'), 'Priya Desai');
insert into purchases (wedding_id, user_id, tier, stripe_payment_intent_id, amount, currency)
values (test_uuid('1400'), test_uuid('141'), 'celebration', 'pi_b14_owner', 4900, 'eur');

-- a partner leaving removes only their access ------------------------------
delete from auth.users where id = test_uuid('142');
select is(
  (select count(*)::int from weddings where id = test_uuid('1400')), 1,
  'a partner deleting their account leaves the wedding in place'
);

-- the owner leaving deletes the wedding and its contents --------------------
delete from auth.users where id = test_uuid('141');
select is(
  (select count(*)::int from weddings where id = test_uuid('1400')), 0,
  'the owner deleting their account deletes the wedding'
);
select is(
  (select count(*)::int from guests where wedding_id = test_uuid('1400')), 0,
  'and everything in it'
);

-- but the payment record stays, anonymised ---------------------------------
select is(
  (select count(*)::int from purchases where stripe_payment_intent_id = 'pi_b14_owner'), 1,
  'the payment record is kept'
);
select is(
  (select wedding_id from purchases where stripe_payment_intent_id = 'pi_b14_owner'), null::uuid,
  'with the wedding link cleared'
);
select is(
  (select user_id from purchases where stripe_payment_intent_id = 'pi_b14_owner'), null::uuid,
  'and the account link cleared'
);

select * from finish();
rollback;
