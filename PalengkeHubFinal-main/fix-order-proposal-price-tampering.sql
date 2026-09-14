-- =====================================================
-- Security review finding: enforce_order_item_prices() (the trigger
-- that recomputes/validates item prices against real product data)
-- only ever fires `before insert` on orders -- never on update. The
-- only update-time guard, enforce_order_update_rules(), blocks a
-- customer from changing items/total_amount ONLY while
-- old.proposed_changes is null. Once a vendor has sent any proposal
-- on an order (a routine, common event -- see VendorOrderDetailScreen.js),
-- old.proposed_changes is permanently non-null and that guard never
-- applies again.
--
-- From that point on, nothing checks the new items/total_amount
-- against real prices OR against what the vendor actually proposed.
-- OrdersScreen.js's handleAcceptProposal computes the new items/total
-- client-side from `proposalData` (itself just a JS object) and
-- PATCHes items/total_amount/proposed_changes straight to the table
-- in one request -- a scripted client can send whatever numbers it
-- wants in that same request, bounded only by the orders
-- non-negative CHECK constraints (fix-orders-negative-amount-guard.sql).
--
-- Fix has two parts, because proposed_changes itself was never
-- protected either -- a customer could PATCH a self-authored
-- "pending" proposal into that field in one request (nothing in
-- enforce_order_update_rules restricted it), then "accept" their own
-- fabricated proposal in a second request, which would satisfy a
-- naive "match old.proposed_changes" check trivially:
--
--   1) A customer may only ever flip an EXISTING pending proposal's
--      status to accepted/rejected -- they can't create one from
--      null, and can't change any other field of it. Only the vendor
--      (who bypasses this whole function via the vendor-owner early
--      return) can write a fresh pending proposal.
--   2) When items/total_amount change, the new values must be EXACTLY
--      what that (now-protected) proposal says -- old.items with only
--      the proposed item's quantity/unit/price replaced, and a total
--      recomputed from that -- rather than trusting whatever the
--      client sends. This mirrors exactly what OrdersScreen.js's
--      handleAcceptProposal already computes client-side; the server
--      just stops trusting the client's arithmetic.
--
-- How to apply:
--   1. Open https://supabase.com/dashboard
--   2. Project: "PalengkeHub" (jjpgmpufwpbgqjzqymvj)
--   3. SQL Editor -> New query -> paste this entire file -> Run
-- =====================================================

create or replace function public.enforce_order_update_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_is_vendor_owner boolean;
  v_item_id text;
  v_proposed_qty numeric;
  v_proposed_unit text;
  v_price_per_unit numeric;
  v_expected_items jsonb;
  v_expected_total numeric;
begin
  select role into v_role from public.profiles where id = auth.uid();

  if v_role = 'admin' then
    return new;
  end if;

  select exists (
    select 1 from public.stalls where id = old.stall_id and vendor_id = auth.uid()
  ) into v_is_vendor_owner;

  if v_is_vendor_owner then
    return new;
  end if;

  if auth.uid() = old.consumer_id then
    if new.status is distinct from old.status and new.status <> 'cancelled' then
      raise exception 'You can only cancel your own order, not set it to %', new.status;
    end if;

    if new.payment_status = 'verified' and old.payment_status is distinct from 'verified' then
      raise exception 'Only the vendor can mark a payment as verified';
    end if;

    -- A customer may only flip an existing PENDING proposal's status
    -- to accepted/rejected. They cannot create one (old must already
    -- be a pending proposal) and cannot change anything else about it
    -- (item_id/proposed_quantity/proposed_unit/price_per_unit/etc. --
    -- everything except `status` must be byte-for-byte identical to
    -- what the vendor wrote).
    if new.proposed_changes::jsonb is distinct from old.proposed_changes::jsonb then
      if old.proposed_changes is null or old.proposed_changes->>'status' <> 'pending' then
        raise exception 'You cannot create or modify a proposal -- only respond to an existing pending one';
      end if;
      if new.proposed_changes->>'status' not in ('accepted', 'rejected') then
        raise exception 'proposed_changes.status must be set to accepted or rejected';
      end if;
      if (new.proposed_changes::jsonb - 'status') is distinct from (old.proposed_changes::jsonb - 'status') then
        raise exception 'You cannot modify the proposal terms, only accept or reject them';
      end if;
    end if;

    if (new.items is distinct from old.items or new.total_amount is distinct from old.total_amount) then
      if old.proposed_changes is null or old.proposed_changes->>'status' <> 'pending' then
        raise exception 'Order items/total can only change in response to a pending vendor proposal';
      end if;

      -- Reconstruct exactly what the vendor's own proposal says the
      -- items/total should become -- old.items with only the
      -- proposed item's quantity/unit/price replaced -- and require
      -- new.items/new.total_amount to match that precisely. The
      -- customer can accept or reject the vendor's numbers; they
      -- cannot substitute their own.
      v_item_id := old.proposed_changes->>'item_id';
      v_proposed_qty := (old.proposed_changes->>'proposed_quantity')::numeric;
      v_proposed_unit := old.proposed_changes->>'proposed_unit';
      v_price_per_unit := (old.proposed_changes->>'price_per_unit')::numeric;

      select jsonb_agg(
        case when (elem->>'id') = v_item_id
          then elem || jsonb_build_object(
            'quantity', v_proposed_qty,
            'unit', v_proposed_unit,
            'price', v_price_per_unit
          )
          else elem
        end
      )
      into v_expected_items
      from jsonb_array_elements(old.items::jsonb) elem;

      select sum((e->>'price')::numeric * (e->>'quantity')::numeric)
      into v_expected_total
      from jsonb_array_elements(v_expected_items) e;

      if new.items::jsonb is distinct from v_expected_items
         or new.total_amount is distinct from v_expected_total then
        raise exception 'Order items/total must exactly match the vendor''s proposed changes';
      end if;
    end if;

    if new.subtotal is distinct from old.subtotal
       or new.stall_id is distinct from old.stall_id
       or new.consumer_id is distinct from old.consumer_id
       or new.vendor_notes is distinct from old.vendor_notes
       or new.cancel_reason is distinct from old.cancel_reason
       or new.payment_rejection_reason is distinct from old.payment_rejection_reason
       or new.order_number is distinct from old.order_number then
      raise exception 'You are not allowed to change that field on your order';
    end if;

    return new;
  end if;

  raise exception 'Not authorized to update this order';
end;
$$;

notify pgrst, 'reload schema';
