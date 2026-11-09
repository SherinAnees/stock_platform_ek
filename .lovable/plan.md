
## Overview

Full rename of the four user roles across DB + code, then a rebuilt User Management module (invite-based creation, profile photos, filters, role-scoped access), plus a My Profile page for every user. Delivered in 3 phases so each is reviewable.

## Phase 1 — Database migration (needs your approval)

**Enum rename** (single migration, in place — RLS/policies keep working because they use `is_admin()` / `is_stockkeeper()` / `is_partner()` helpers):

| Old label | New label |
|---|---|
| `admin` | `stock_center_admin` |
| `stockkeeper` | `store_keeper` |
| `partner` | `designer_order_processor` |
| `master_admin` | unchanged |

- Rebind helper functions to the new labels (`is_admin` returns true for `master_admin` OR `stock_center_admin`; `is_stockkeeper` → store_keeper; `is_partner` → designer_order_processor). Function names stay so no RLS churn.
- Update `handle_new_user` to seed first user as `master_admin`.
- Update `tg_protect_last_master_admin` (already keyed by literal — re-verified).

**Profiles table additions:** `first_name`, `last_name`, `phone`, `job_title`, `avatar_url`, `invitation_status` (`pending` | `active` | `inactive`), `last_login_at`, `invited_at`, `created_by`, `updated_at`, `updated_by`.
Backfill `first_name`/`last_name` by splitting `full_name`; keep `full_name` as a generated/updated field for backwards compatibility.

**RLS updates on `profiles` and `user_roles`:**
- Master Admin: full access to all profiles/roles.
- Stock Center Admin: SELECT/UPDATE only profiles where `stock_center_id = my_stock_center_id()` AND role ∈ {store_keeper, designer_order_processor}; can only assign those two roles; cannot deactivate self.
- Others: read/update own profile only (no role/stock_center changes).

**New RPCs:**
- `admin_create_user(email, first_name, last_name, phone, job_title, role, stock_center_id, avatar_url)` — server fn wrapper will call `auth.admin.inviteUserByEmail` first, then this RPC populates profile + role. Blocks stock_center_admin from creating higher roles or cross-center users.
- `admin_update_user(...)` — same scoping rules.
- `admin_toggle_active(user_id, active)` — blocks self, blocks last master_admin.
- `admin_resend_invitation(user_id)` — server fn wraps `auth.admin.generateLink({type:'invite'})`.

**Storage:** create private `avatars` bucket via tool with per-user RLS (owner writes own, everyone reads own, admins read all).

## Phase 2 — Server functions + rebuilt Users module

- `src/lib/users/admin.functions.ts` — `createServerFn` variants for invite / update / reset password / toggle active / resend invitation, all `.middleware([requireSupabaseAuth])`, using `supabaseAdmin` after verifying caller's role via `context.supabase`.
- New `src/routes/_authenticated/users.tsx`:
  - Toolbar: search (name/email), Role filter, Stock Center filter (hidden for stock_center_admin), Status filter (All / Active / Inactive / Pending), "Add User" button.
  - Table columns: Avatar, Name, Email, Role badge (color-coded), Stock Center, Job Title, Status, Last Login, Actions (Edit / Reset Password / Deactivate·Activate / Resend Invitation).
  - Row-level scoping enforced server-side by RLS; UI just reflects what came back.
- `AddEditUserDialog.tsx`: form with all required fields, avatar upload, role dropdown filtered by editor's role, stock center dropdown (locked to own center for stock_center_admin, hidden for master_admin role selection).
- Role badges use existing design tokens; new semantic tokens added to `src/styles.css` (`--role-master-admin`, `--role-sc-admin`, `--role-store-keeper`, `--role-designer`).

## Phase 3 — My Profile + login tracking + nav guards

- New route `src/routes/_authenticated/profile.tsx` — every role can view/edit own First/Last name, Phone, Job Title, Avatar. Email / role / stock center shown read-only. "Change Password" button triggers reset email.
- Sidebar user block in `AppShell.tsx` becomes a link to `/profile`.
- On sign-in, update `profiles.last_login_at` and flip `invitation_status` from `pending` → `active` (server fn called from `onAuthStateChange` in `__root.tsx`).
- Nav guard updates in `AppShell.tsx`:
  - `/users` visible to `master_admin` and `stock_center_admin` only.
  - Rename all existing role label strings across the sidebar / badges to the new names.
- Update all remaining code references (`useSession.ts`, `queries.ts`, `orders.$orderId.tsx`, `inventory.tsx`, `reorder.tsx`) so role literals and `isX` helpers use the new names, while keeping helper behavior identical.

## Technical notes

- Enum uses PG's `ALTER TYPE ... RENAME VALUE` — no data migration needed, existing `user_roles` rows re-point automatically.
- Auth invitations use Supabase's built-in email templates (as you chose) — no email domain setup required.
- No behavioural permission changes in Phase 1; permissions are only tightened in Phase 2 when the new admin RPCs land.
- `partners` table and `profiles.partner_id` column names kept as-is (you chose that).

## Verification after Phase 3

Runs through your Step 7 checklist: create a Store Keeper as Master Admin → verify invitation email fires, appears as Pending; log in as SC-UAE Stock Center Admin → verify only SC-UAE store_keeper/designer rows appear and role dropdown lacks admin options; deactivate a user → confirm login blocked but historical rows preserved; designer_order_processor login → confirm Users hidden from nav.
