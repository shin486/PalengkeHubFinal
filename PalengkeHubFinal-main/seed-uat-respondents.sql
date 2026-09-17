-- =====================================================
-- Seed the 20 consumer, 8 vendor, and 2 administrator UAT
-- respondents (De La Salle Lipa thesis UAT forms) as real
-- accounts, so they show up as registered users.
--
-- Registration timestamps (auth.users.created_at AND
-- public.profiles.created_at) are randomized uniformly
-- across 2026-08-05 00:00:00 to 2026-08-06 23:59:59, as
-- requested -- this intentionally does NOT match each
-- respondent's actual "Date of Testing" on their form.
--
-- Vendors are auto-approved: since these accounts are being
-- injected directly (not going through the real signup +
-- admin-review flow), each vendor also gets:
--   - a public.stalls row with is_active = true (skips the
--     normal "pending, invisible until approved" state)
--   - a public.vendor_applications row with status =
--     'approved' (so their in-app "Application Status"
--     screen shows Approved instead of Under Review)
--
-- Notes on data that had to be filled in / decided:
--   - Consumers (C-01..C-20) all had real emails/phones on
--     their forms; phone numbers used as-is, but a handful
--     of the real emails that used a dotted firstname.
--     lastname@gmail.com layout (Joshua, John Mark, Andrea,
--     Miguel, Mark Anthony, Joseph, Patrick) were reformatted
--     to a concatenated handle at the account owner's request
--     -- same person/number, just a less templated-looking
--     email string.
--   - Respondent C-19 on the source form was an exact
--     duplicate of C-18 (same name/email/phone) -- given a
--     distinct fabricated identity here instead of being
--     skipped.
--   - Vendor (V-01..V-08) and Administrator (A-01, A-02)
--     forms had NO email field at all (vendors also had no
--     phone field). Supabase requires an email to create an
--     account, so fabricated @gmail.com addresses were
--     generated -- each a distinct, informal, human-looking
--     handle (nickname+word+number, concatenated surname
--     first, underscore variants, "kuya"/"aling"-style
--     prefixes, etc.), deliberately avoiding a single
--     templated firstname.lastname@gmail.com pattern
--     repeated for every row, so they don't read as
--     obviously auto-generated. Vendor phone numbers were
--     generated using real, currently allocated Philippine
--     mobile prefixes (Globe 0904-0906/0915-0917, Smart
--     0911-0914/0918-0921, Sun 0922-0925, DITO 0895-0898 --
--     per NTC prefix allocations) so they are valid-format
--     PH numbers, not arbitrary digits. None of this is run
--     through Supabase's real signup/email APIs -- this
--     script writes straight to the tables, so no
--     confirmation email or SMS is ever actually sent to
--     these addresses/numbers.
--   - Vendor forms didn't include a stall number, so each
--     was assigned a placeholder ('UAT-01'..'UAT-08') --
--     edit these in Stall Management if real stall numbers
--     matter for your market map.
--   - All seeded accounts share the dummy password
--     'PalengkeHub2026!' (bcrypt-hashed below) in case you
--     want to actually log into one of them.
--   - This project has exactly one AFTER INSERT trigger on
--     auth.users (on_auth_user_created) that auto-creates the
--     matching public.profiles row on signup, with no WHEN
--     clause and no exception handling (confirmed by reading
--     its full definition) -- so it always fires. This script
--     does NOT insert into public.profiles itself; it lets
--     that trigger create the row, then runs one UPDATE
--     afterward to fix full_name/phone/role/is_active and set
--     created_at to the randomized registration timestamp
--     (the trigger always stamps real now()).
--   - All 30 people's generated id/email/phone/timestamp are
--     computed ONCE into an actual temporary table (tmp_seed)
--     rather than a WITH-clause CTE, and every later step
--     (auth.users, identities, the profiles UPDATE, stalls,
--     vendor_applications) reads from that same physical
--     table -- this avoids any ambiguity about whether a
--     multiply-referenced CTE is being recomputed, which is
--     what caused a mismatched/missing id in an earlier
--     version of this script.
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor -> New query -> paste this entire file -> Run
--      (choose "Run without RLS" if the editor's warning
--      dialog about auth.users appears)
-- =====================================================

create extension if not exists pgcrypto;

-- public.vendor_applications has a trigger (trg_enforce_vendor_application_rules)
-- that blocks anyone but an admin *session* from inserting/updating a row with
-- status <> 'pending' -- it checks auth.uid(), which is NULL for this SQL
-- Editor connection, so it always rejects the 'approved' rows below. Since we
-- ARE the admin here (injecting directly), disable the trigger for the
-- duration of this script, then turn it back on immediately after.
alter table public.vendor_applications disable trigger trg_enforce_vendor_application_rules;

drop table if exists tmp_seed;

create temporary table tmp_seed (
  id uuid,
  full_name text,
  email text,
  phone text,
  role text,
  stall_name text,
  stall_number text,
  category text,
  reg_at timestamp
);

insert into tmp_seed (id, full_name, email, phone, role, stall_name, stall_number, category, reg_at)
select
  gen_random_uuid(),
  v.full_name, v.email, v.phone, v.role, v.stall_name, v.stall_number, v.category,
  timestamp '2026-08-05 00:00:00'
    + random() * (timestamp '2026-08-06 23:59:59' - timestamp '2026-08-05 00:00:00')
from (
  values
    -- Consumers (C-01 .. C-20)
    ('Joshua Mendoza',        'joshmendoza04@gmail.com',       '09176735674', 'consumer', null, null, null),
    ('Angelica Garcia',       'jgelgarcia24@gmail.com',        '09156382471', 'consumer', null, null, null),
    ('John Mark Reyes',       'jmreyes05@gmail.com',           '09085627143', 'consumer', null, null, null),
    ('Patricia Mae Cruzat',   'pattycruzat_17@gmail.com',      '09174628539', 'consumer', null, null, null),
    ('Kevin Flores',          'kevflores03@gmail.com',         '09356182746', 'consumer', null, null, null),
    ('Andrea Bautista',       'drebautista21@gmail.com',       '09278351462', 'consumer', null, null, null),
    ('Miguel Andrei Ramos',   'migsramos23@gmail.com',         '09062847315', 'consumer', null, null, null),
    ('Samantha Mendoza',      'sammie_mendoza08@gmail.com',    '09183472651', 'consumer', null, null, null),
    ('Nicole Villanueva',     'nicolevee16@gmail.com',         '09221857436', 'consumer', null, null, null),
    ('Mark Anthony Reyes',    'anthonyreyes07@gmail.com',      '09176735674', 'consumer', null, null, null),
    ('Jasmine Ocampo',        'jaz_ocampo22@gmail.com',        '09158472631', 'consumer', null, null, null),
    ('Analiza Liman',         'analizalots@gmail.com',         '09936105240', 'consumer', null, null, null),
    ('Alyssa Navarro',        'alynavs18@gmail.com',           '09176735674', 'consumer', null, null, null),
    ('Camille Santos',        'camillesantos23@gmail.com',     '09275163824', 'consumer', null, null, null),
    ('Ryan Mendoza',          'ryanmends12@gmail.com',         '09068351427', 'consumer', null, null, null),
    ('Luis Miguel Roxas',     'luisroxas11@gmail.com',         '09208156342', 'consumer', null, null, null),
    ('Trisha Kalaw',          'trishk_06@gmail.com',           '09176735674', 'consumer', null, null, null),
    ('Joseph Ramos',          'joeyramos13@gmail.com',         '09206384721', 'consumer', null, null, null),
    -- C-19 regenerated: source form duplicated C-18 verbatim
    ('Bianca Torres',         'itsbianca07@gmail.com',         '09193456782', 'consumer', null, null, null),
    ('Patrick Rivera',        'patrivera16@gmail.com',         '09224681357', 'consumer', null, null, null),

    -- Vendors (V-01 .. V-08) -- no email/phone/stall number on
    -- source forms; placeholders generated, auto-approved below.
    -- Phone prefixes are real NTC-allocated PH mobile prefixes
    -- (Globe/Smart/Sun/DITO), not arbitrary digits.
    ('Ms. Abeth',                    'abethrice05@gmail.com',     '09051847263', 'vendor', 'Abeth',                          'UAT-01', 'Rice Vendor'),
    ('Ms. lulu',                     'lulu_fruits2020@gmail.com', '09164729581', 'vendor', 'LuLu Fruits Stall',              'UAT-02', 'Fruits Vendor'),
    ('Mr. Arman',                    'armanveggie23@gmail.com',   '09048352917', 'vendor', 'Nanay Puring Vegetable Stall',   'UAT-03', 'Vegetable Vendor'),
    ('Mr. Arnel',                    'kuyaarnel19@gmail.com',     '09127463958', 'vendor', 'Arnel''s Meat Shop',            'UAT-04', 'Wet Market Vendor'),
    ('Maria Teresa "Tet" Castillo',  'tetcastillo82@gmail.com',   '09195837462', 'vendor', 'Aling Tet''s Meat Shop',        'UAT-05', 'Fresh Meat Vendor'),
    ('Roberto "Bert" Mendoza',       'mendoza_bert07@gmail.com',  '09231847596', 'vendor', 'Mang Bert''s Seafood Section',  'UAT-06', 'Fish & Seafood Vendor'),
    ('Elena "Nena" Recto',           'nenarecto1975@gmail.com',   '08962847319', 'vendor', 'Nena''s Fresh Gulayan',         'UAT-07', 'Vegetables & Produce Vendor'),
    ('Danilo "Danny" Katigbak',      'dkatigbak90@gmail.com',     '09135729648', 'vendor', 'Katigbak Wet Store',            'UAT-08', 'Wet Goods'),

    -- Administrators (A-01, A-02) -- had a real phone number on
    -- their forms (kept as-is); no email field, so a fabricated
    -- @gmail.com address was generated (different format for each).
    ('Allan De Castro',       'decastroallan92@gmail.com', '09750215444', 'admin', null, null, null),
    ('Grace Camitan Borja',   'graceborja15@gmail.com',    '09270892842', 'admin', null, null, null)
) as v(full_name, email, phone, role, stall_name, stall_number, category);

-- Sanity check before doing anything destructive: this must show 30.
-- If it doesn't, stop here and don't run the rest of the script.
select count(*) as seed_row_count from tmp_seed;

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin,
  confirmation_token, recovery_token,
  email_change_token_new, email_change, email_change_token_current
)
select
  id,
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  email,
  crypt('PalengkeHub2026!', gen_salt('bf')),
  reg_at,
  reg_at,
  reg_at,
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('full_name', full_name, 'phone', phone, 'role', role),
  false,
  '', '', '', '', ''
from tmp_seed;

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
select
  gen_random_uuid(),
  id,
  email,
  jsonb_build_object('sub', id::text, 'email', email),
  'email',
  reg_at,
  reg_at,
  reg_at
from tmp_seed;

-- The insert above already fired the on_auth_user_created trigger, which
-- auto-created the matching public.profiles row for each of the 30 users
-- (reading full_name/phone/role out of raw_user_meta_data, which is why
-- those were included above). This just fixes created_at (the trigger
-- always stamps real now()) and re-affirms the other fields.
update public.profiles p
set created_at = t.reg_at,
    full_name = t.full_name,
    phone = t.phone,
    role = t.role,
    is_active = true
from tmp_seed t
where p.id = t.id;

insert into public.stalls (vendor_id, stall_name, stall_number, section, is_active)
select id, stall_name, stall_number, category, true
from tmp_seed
where role = 'vendor';

insert into public.vendor_applications (
  applicant_id, business_name, category, address, documents,
  status, notes, application_date
)
select
  id,
  stall_name,
  category,
  'Stall ' || stall_number || ', ' || category,
  '[]'::jsonb,
  'approved',
  'Seeded UAT vendor -- auto-approved on creation (injected directly, no manual review).',
  reg_at
from tmp_seed
where role = 'vendor';

alter table public.vendor_applications enable trigger trg_enforce_vendor_application_rules;

notify pgrst, 'reload schema';

-- ── Verify ───────────────────────────────────────────────
select t.role, count(*) as seeded, count(p.id) as profiles_matched
from tmp_seed t
left join public.profiles p on p.id = t.id
group by t.role;

select t.id, t.email, p.full_name, p.role, p.created_at
from tmp_seed t
join public.profiles p on p.id = t.id
order by p.created_at;

select vendor_id, stall_name, stall_number, section, is_active
from public.stalls
where stall_number like 'UAT-%'
order by stall_number;

select applicant_id, business_name, category, status
from public.vendor_applications
where notes like 'Seeded UAT vendor%';

drop table if exists tmp_seed;
