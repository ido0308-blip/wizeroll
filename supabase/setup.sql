-- WIZEROLL: tables, permissions and sample data.
-- Run once in the Supabase SQL Editor. All data here is demo data.

-- Tables

create table public.product_specs (
  id uuid primary key default gen_random_uuid(),
  field_key text not null unique,
  customer_label_template text not null,
  value_type text not null check (value_type in ('numeric_range', 'categorical')),
  min_value numeric,
  max_value numeric,
  allowed_values jsonb,
  created_at timestamptz not null default now()
);

create table public.faults (
  id uuid primary key default gen_random_uuid(),
  symptom text not null,
  likely_cause text,
  fix_instructions text not null,
  self_fixable boolean not null,
  created_at timestamptz not null default now()
);

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  request_type text not null check (request_type in ('fit_check', 'service')),
  customer_email text not null,
  conversation_log jsonb not null default '[]'::jsonb,
  extracted_fields jsonb,
  verdict text check (verdict in ('fit', 'fit_with_reservation', 'not_fit')),
  verdict_field_key text,
  wants_order boolean not null default false,
  reminder_sent boolean not null default false,
  matched_fault_id uuid references public.faults (id),
  fault_match_confidence text check (fault_match_confidence in ('high', 'low', 'not_identified')),
  status text not null check (status in ('recorded', 'resolved', 'pending', 'approved', 'rejected')),
  owner_decision text check (owner_decision in ('replacement', 'credit', 'special_quote')),
  owner_decision_note text,
  escalation_sent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger requests_set_updated_at
before update on public.requests
for each row execute function public.set_updated_at();

-- Table privileges

revoke all on public.product_specs, public.faults, public.requests from anon, authenticated;

grant select on public.product_specs, public.faults to anon;
grant insert on public.requests to anon;

grant select, insert, update, delete on public.product_specs, public.faults to authenticated;
grant select, update on public.requests to authenticated;

-- Row level security

alter table public.product_specs enable row level security;
alter table public.faults enable row level security;
alter table public.requests enable row level security;

create policy "anon reads product_specs" on public.product_specs
  for select to anon using (true);

create policy "owner manages product_specs" on public.product_specs
  for all to authenticated using (true) with check (true);

create policy "anon reads faults" on public.faults
  for select to anon using (true);

create policy "owner manages faults" on public.faults
  for all to authenticated using (true) with check (true);

create policy "anon creates requests" on public.requests
  for insert to anon
  with check (
    status in ('recorded', 'resolved', 'pending')
    and owner_decision is null
    and owner_decision_note is null
    and reminder_sent = false
    and escalation_sent = false
  );

create policy "owner reads requests" on public.requests
  for select to authenticated using (true);

create policy "owner updates requests" on public.requests
  for update to authenticated using (true) with check (true);

-- Sample data: product_specs (demo values, real values replace them before milestone 2)

insert into public.product_specs
  (field_key, customer_label_template, value_type, min_value, max_value, allowed_values)
values
  ('desk_height_cm', 'Fits a desk height of {min} to {max} cm [demo value]', 'numeric_range', 70, 95, null),
  ('customer_height_cm', 'Fits a user height of {min} to {max} cm [demo value]', 'numeric_range', 150, 195, null),
  ('customer_weight_kg', 'Supports a user weight of {min} to {max} kg [demo value]', 'numeric_range', 40, 130, null),
  ('daily_sitting_hours', 'Suited to {min} to {max} sitting hours a day [demo value]', 'numeric_range', 0, 10, null),
  ('floor_type', 'Rolls on these floor types: {values} [demo value]', 'categorical', null, null, '["tile", "laminate", "hardwood", "low-pile carpet"]'),
  ('sitting_style', 'Supports these sitting styles: {values} [demo value]', 'categorical', null, null, '["upright", "forward-leaning", "perched"]');

-- Sample data: faults

insert into public.faults (symptom, likely_cause, fix_instructions, self_fixable)
values
  ('The stool sinks slowly while I sit on it', 'Worn gas lift cylinder', 'The gas lift needs to be replaced. Stop adjusting the height and open a service request.', false),
  ('The stool does not go up or down when I press the lever', 'Lever cable is loose', 'Turn the stool over, then tighten the screw that holds the lever cable until the lever feels firm.', true),
  ('The seat wobbles from side to side', 'Loose seat plate screws', 'Turn the stool over and tighten the four seat plate screws with the supplied hex key.', true),
  ('A caster does not roll smoothly', 'Hair or dust caught in the caster', 'Pull the caster out of the base, remove any hair or dust from the axle, then push it back until it clicks.', true),
  ('A caster fell off the base', 'Caster stem is not fully seated', 'Push the caster stem back into the base firmly until it clicks. If it does not hold, open a service request.', true),
  ('The stool squeaks when I move', 'Dry joint between the cylinder and the base', 'Wipe the joint between the cylinder and the base, then apply a small amount of silicone spray.', true),
  ('The stool leaves marks on the floor', 'Casters do not suit the floor type', 'Clean the casters with a damp cloth, then test the stool on a small area of the floor.', true),
  ('The base has a visible crack', 'Structural damage to the base', 'Stop using the stool and open a service request. A cracked base cannot be repaired at home.', false),
  ('The upholstery is torn', 'Wear or a sharp object', 'Stop using the damaged area and open a service request. Upholstery cannot be repaired at home.', false),
  ('The backrest does not stay in place', 'Loose backrest knob', 'Set the backrest to the position you want, then turn the knob clockwise until it is tight.', true);

-- Sample data: requests (made-up customers)

insert into public.requests
  (request_type, customer_email, conversation_log, extracted_fields, verdict, verdict_field_key, wants_order, status)
values
  (
    'fit_check',
    'dana.demo@example.com',
    '[{"role": "customer", "text": "I am a barber, 170 cm, 65 kg, my counter is 85 cm and I sit 6 hours a day on tile, upright.", "at": "2026-11-01T09:00:00Z"}, {"role": "advisor", "text": "Your details are within the supported ranges, so the stool fits.", "at": "2026-11-01T09:00:05Z"}]',
    '{"desk_height_cm": 85, "customer_height_cm": 170, "customer_weight_kg": 65, "daily_sitting_hours": 6, "floor_type": "tile", "sitting_style": "upright"}',
    'fit',
    'desk_height_cm',
    true,
    'recorded'
  ),
  (
    'fit_check',
    'omer.demo@example.com',
    '[{"role": "customer", "text": "I am a dentist, 180 cm, 80 kg, my desk is 110 cm and I sit 8 hours a day on laminate, leaning forward.", "at": "2026-11-02T10:30:00Z"}, {"role": "advisor", "text": "Your desk height of 110 cm is outside the supported range, so the stool does not fit.", "at": "2026-11-02T10:30:06Z"}]',
    '{"desk_height_cm": 110, "customer_height_cm": 180, "customer_weight_kg": 80, "daily_sitting_hours": 8, "floor_type": "laminate", "sitting_style": "forward-leaning"}',
    'not_fit',
    'desk_height_cm',
    false,
    'recorded'
  );

insert into public.requests
  (request_type, customer_email, conversation_log, matched_fault_id, fault_match_confidence, status, owner_decision, owner_decision_note)
values
  (
    'service',
    'noa.demo@example.com',
    '[{"role": "customer", "text": "My seat wobbles a bit.", "at": "2026-11-02T14:00:00Z"}, {"role": "advisor", "text": "Tighten the four seat plate screws with the supplied hex key. Did that solve it?", "at": "2026-11-02T14:00:04Z"}, {"role": "customer", "text": "Yes, solved.", "at": "2026-11-02T14:10:00Z"}]',
    (select id from public.faults where symptom = 'The seat wobbles from side to side'),
    'high',
    'resolved',
    null,
    null
  ),
  (
    'service',
    'yael.demo@example.com',
    '[{"role": "customer", "text": "The stool keeps sinking when I sit on it.", "at": "2026-11-03T08:15:00Z"}, {"role": "advisor", "text": "Your request was passed to the business owner and is waiting to be handled.", "at": "2026-11-03T08:15:05Z"}]',
    (select id from public.faults where symptom = 'The stool sinks slowly while I sit on it'),
    'high',
    'pending',
    null,
    null
  ),
  (
    'service',
    'amit.demo@example.com',
    '[{"role": "customer", "text": "There is a crack in the base.", "at": "2026-10-30T16:20:00Z"}, {"role": "advisor", "text": "Your request was passed to the business owner and is waiting to be handled.", "at": "2026-10-30T16:20:05Z"}]',
    (select id from public.faults where symptom = 'The base has a visible crack'),
    'high',
    'approved',
    'replacement',
    'Demo decision: replace the base.'
  );
