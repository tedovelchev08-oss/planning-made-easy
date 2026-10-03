-- ============================================================
-- Luma · pgTAP · purchases ledger (0009)
--
-- Members read their wedding's purchases; nobody but the service role
-- writes them. Run with: supabase test db
-- ============================================================

begin;
select plan(12);

create or replace function test_uuid(suffix text)
returns uuid
language sql immutable
as $$
  select ('00000000-0000-0000-0000-' || lpad(suffix, 12, '0'))::uuid;
$$;

-- fixtures, as postgres, before any role switch ------------------------
insert into auth.users (id, email, encrypted_password, email_confirmed_at)
values
  (test_uuid('31'), 'buyer@example.com', 'hashed', now()),
  (test_uuid('32'), 'stranger@example.com', 'hashed', now());

insert into weddings (id, owner_id, slug, names, date)
values (test_uuid('300'), test_uuid('31'), 'ledger-test', 'Buyer & Partner', now() + interval '1 year');
insert into wedding_members (wedding_id, user_id, role) values (test_uuid('300'), test_uuid('31'), 'owner');

insert into purchases (id, wedding_id, user_id, tier, stripe_payment_intent_id, amount)
values (test_uuid('400'), test_uuid('300'), test_uuid('31'), 'celebration', 'pi_test_ledger_1', 9900);

-- reading -----------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000031", "role": "authenticated"}';

select results_eq(
  $$ select stripe_payment_intent_id from purchases $$,
  $$ values ('pi_test_ledger_1'::text) $$,
  'a member reads their wedding''s purchases'
);

-- writing, as that member ---------------------------------------------------
select throws_ok(
  $$ insert into purchases (wedding_id, user_id, tier, stripe_payment_intent_id, amount)
     values (test_uuid('300'), test_uuid('31'), 'luxe', 'pi_forged', 0) $$,
  '42501', null,
  'a member cannot record a purchase (no free Luxe)'
);

update purchases set amount_refunded = 9900, status = 'refunded' where id = test_uuid('400');
delete from purchases where id = test_uuid('400');

set local role postgres;
select results_eq(
  $$ select status, amount_refunded from purchases where id = test_uuid('400') $$,
  $$ values ('paid'::text, 0) $$,
  'a member cannot update or delete a purchase'
);

-- a stranger and anon ------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-000000000032", "role": "authenticated"}';
select is_empty($$ select * from purchases $$, 'a non-member sees no purchases');

set local role anon;
select is_empty($$ select * from purchases $$, 'anon sees no purchases');
select throws_ok(
  $$ insert into purchases (tier, stripe_payment_intent_id, amount) values ('luxe', 'pi_anon', 0) $$,
  '42501', null,
  'anon cannot record a purchase'
);

-- the webhook's path ---------------------------------------------------------
set local role service_role;

select lives_ok(
  $$ insert into purchases (wedding_id, user_id, tier, stripe_payment_intent_id, amount)
     values (test_uuid('300'), test_uuid('31'), 'luxe', 'pi_test_ledger_2', 19900) $$,
  'the service role records a purchase'
);
select lives_ok(
  $$ update purchases set amount_refunded = 1000, status = 'partially_refunded'
      where stripe_payment_intent_id = 'pi_test_ledger_2' $$,
  'the service role records a refund'
);
select throws_ok(
  $$ insert into purchases (tier, stripe_payment_intent_id, amount) values ('luxe', 'pi_test_ledger_2', 19900) $$,
  '23505', null,
  'one row per payment intent: a replayed webhook cannot double-record'
);
select throws_ok(
  $$ insert into purchases (tier, stripe_payment_intent_id, amount) values ('luxe', 'pi_negative', -1) $$,
  '23514', null,
  'amounts cannot be negative'
);
select throws_ok(
  $$ insert into purchases (tier, stripe_payment_intent_id, amount, status) values ('luxe', 'pi_status', 1, 'chargeback') $$,
  '23514', null,
  'status is one of paid, partially_refunded, refunded'
);

-- the service role can still set the plan the refund path computes -----------
select lives_ok(
  $$ update weddings set plan = 'celebration' where id = test_uuid('300') $$,
  'the service role sets the wedding plan after a refund (0008 trigger lets it through)'
);

select * from finish();
rollback;
