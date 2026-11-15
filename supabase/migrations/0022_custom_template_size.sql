-- ============================================================
-- Twofold · 0022: a couple's own designs have a size limit in the database
--
-- The planner stops at about 4 MB of own designs, but only in the browser:
-- a member calling the API directly could store rows of any size, and each
-- one is sent to every guest who opens the invitation. This puts the limit
-- where it can't be skipped.
--
-- NOT VALID: rows already stored are left alone (nothing is rejected or
-- deleted by this migration); every new or changed row is checked.
-- Safe to run more than once.
-- ============================================================

alter table custom_templates drop constraint if exists custom_templates_size;
alter table custom_templates
  add constraint custom_templates_size
  check (coalesce(length(html), 0) + coalesce(length(data_url), 0) <= 4500000) not valid;
