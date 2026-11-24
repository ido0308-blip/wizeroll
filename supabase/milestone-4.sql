-- WIZEROLL milestone 4: the owner can decide only on a pending service request.
-- Run once in the Supabase SQL Editor, after setup.sql.

drop policy if exists "owner updates requests" on public.requests;

create policy "owner decides pending service requests" on public.requests
  for update to authenticated
  using (request_type = 'service' and status = 'pending')
  with check (
    request_type = 'service'
    and (
      (status = 'approved' and owner_decision is not null)
      or (status = 'rejected' and owner_decision is null)
    )
  );
