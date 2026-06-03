-- ============================================================================
-- Map of Knowledge — Database Schema
-- Source : Map of Knowledge PRD v0.2 (KaiQ), §17 "Database Schema"
-- Target : PostgreSQL 14+ (Supabase)
--
-- Faithfully transcribed from the PRD, expressed as runnable Postgres DDL with
-- appropriate types, primary/foreign keys, constraints, indexes, and column
-- documentation. Tables the PRD marks POST-MVP are included so later features
-- do not require breaking migrations (per the PRD's own instruction in §17).
--
-- DESIGN DECISIONS (none of these change the PRD's intent; flagged so they are
-- easy to review or override):
--
--   1. users.id is a standalone uuid here so this file runs anywhere. In
--      Supabase this table maps 1:1 to auth.users — to wire it up, replace the
--      id line with:
--        id uuid primary key references auth.users(id) on delete cascade
--
--   2. enum vs text: the PRD declares some columns `enum` and others `text`
--      (suggestions.type, achievements.achievement_type, llm_usage_log.call_type).
--      That distinction is preserved exactly — only PRD-declared enums become
--      Postgres enum types. The text columns keep their known values in comments.
--
--   3. ON DELETE behavior (the PRD does not specify this, but §15.4 requires
--      "immediate, irreversible" account deletion, and §04/§08 require nodes to
--      never be deleted and user data to never be orphaned). Resolved as:
--        - node references            -> ON DELETE RESTRICT  (nodes never deleted)
--        - personal data owned by user-> ON DELETE CASCADE   (knowledge, notes,
--                                        test_sessions, knowledge_imports,
--                                        share_links, achievements, learning_paths)
--        - suggestions.user_id        -> ON DELETE SET NULL  (contributions to the
--                                        canonical map outlive the contributor;
--                                        §15.4's deletion list omits suggestions)
--        - llm_usage_log.user_id      -> ON DELETE SET NULL  (billing/audit record
--                                        retained for cost monitoring per §13)
--        - granted_by / reviewed_by   -> ON DELETE SET NULL  (an acting admin
--                                        leaving must not delete others' data)
--      The three SET NULL columns are therefore nullable (a documented, minor
--      deviation from the PRD field tables, which list them as required).
--
--   4. "order" (layers.order) is a SQL reserved word; it is kept as the PRD
--      names it but must always be double-quoted: layers."order".
--
--   5. Row Level Security is NOT enabled here. Given the PRD's strong privacy
--      requirements (§10.1, §10.3, §15.1 — personal map and notes are private by
--      default), enabling RLS with per-user policies is the recommended next
--      step before launch. Left out so this script doesn't silently lock tables.
--
--   6. The Professions Layer (§06) needs no dedicated table: it is a row in
--      `layers` plus edges of edge_type = 'profession_requirement'.
-- ============================================================================


-- gen_random_uuid() ships with core Postgres 13+ and Supabase by default.
-- Uncomment on older instances:
-- create extension if not exists pgcrypto;


-- ============================================================================
-- ENUM TYPES
-- ============================================================================

create type subscription_status as enum ('free', 'subscriber', 'cancelled');
create type user_role           as enum ('admin', 'super_admin');
create type access_tier         as enum ('guest', 'registered', 'subscriber');
create type knowledge_source    as enum ('tested', 'self_reported', 'predicted');
create type edge_type           as enum ('hierarchy', 'cross_layer', 'profession_requirement');
create type suggestion_status   as enum ('pending', 'approved', 'rejected', 'needs_clarification');
create type share_access_type   as enum ('one_time', 'expiring', 'permanent');


-- ============================================================================
-- updated_at helper — keeps updated_at columns current on every UPDATE
-- ============================================================================

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ============================================================================
-- users
-- ============================================================================

create table users (
  id                       uuid primary key default gen_random_uuid(),
  email                    text        not null unique,
  display_name             text,
  subscription_status      subscription_status not null default 'free',
  subscription_period_end  timestamptz,
  stripe_customer_id       text,
  created_at               timestamptz not null default now()
);

comment on table  users is 'Application user. In Supabase, id maps 1:1 to auth.users(id).';
comment on column users.subscription_period_end is 'Access continues until this time after cancellation, then reverts to free (PRD §14).';


-- ============================================================================
-- user_roles
-- A grant record. Composite PK prevents granting the same role twice.
-- ============================================================================

create table user_roles (
  user_id     uuid      not null references users(id) on delete cascade,
  role        user_role not null,
  granted_by  uuid      references users(id) on delete set null,  -- nullable: see design note 3
  granted_at  timestamptz not null default now(),
  primary key (user_id, role)
);

comment on table  user_roles is 'Admin / super_admin grants. The initial super_admin is the account owner; there is no self-service path to admin (PRD §07).';
comment on column user_roles.granted_by is 'The admin who granted this role. Null if that admin has since been deleted.';


-- ============================================================================
-- layers
-- ============================================================================

create table layers (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  "order"    int         not null,                 -- reserved word; always quote. Controls 3D depth render order.
  min_tier   access_tier not null default 'registered',
  is_active  boolean     not null default true
);

comment on column layers."order"   is 'RESERVED WORD — must be double-quoted. Controls front-to-back 3D depth rendering order (PRD §06).';
comment on column layers.min_tier   is 'Minimum tier required to browse this layer. Base Knowledge = guest (PRD §05/§06).';


-- ============================================================================
-- nodes
-- Permanent: once published a node is never deleted (PRD §04/§08).
-- ============================================================================

create table nodes (
  id          uuid        primary key default gen_random_uuid(),
  label       text        not null,
  level       int         not null check (level between 1 and 5),
  layer_id    uuid        not null references layers(id) on delete restrict,
  is_active   boolean     not null default true,
  description text,                                  -- null in MVP — reserved for future (PRD §08.1)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table  nodes is 'Canonical map node. PERMANENT — never deleted, only relocated / promoted / demoted / deactivated, so user knowledge mapped to a node id is never orphaned (PRD §08.2).';
comment on column nodes.label       is 'The only content field in MVP (PRD §08.1).';
comment on column nodes.level       is 'L1 domain root … L5 leaf concept. Assessment applies to L4/L5 only (PRD §06.2).';
comment on column nodes.is_active   is 'Deactivated nodes are hidden from the UI but retained with all associated user data (PRD §08.2).';
comment on column nodes.description is 'Reserved for future use; null and unused in MVP (PRD §08.1).';

create trigger trg_nodes_updated_at
  before update on nodes
  for each row execute function set_updated_at();


-- ============================================================================
-- edges
-- Hierarchy (parent->child), cross-layer references, and profession requirements.
-- ============================================================================

create table edges (
  id              uuid        primary key default gen_random_uuid(),
  source_node_id  uuid        not null references nodes(id) on delete restrict,  -- parent
  target_node_id  uuid        not null references nodes(id) on delete restrict,  -- child
  edge_type       edge_type   not null,
  created_at      timestamptz not null default now(),
  constraint edges_no_self_loop check (source_node_id <> target_node_id),
  constraint edges_unique       unique (source_node_id, target_node_id, edge_type)
);

comment on table edges is 'hierarchy = parent/child within the level tree; cross_layer = derived-layer references to base nodes; profession_requirement = profession node -> required knowledge node (PRD §06/§17).';


-- ============================================================================
-- user_node_knowledge
-- One knowledge record per user per node.
-- ============================================================================

create table user_node_knowledge (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references users(id) on delete cascade,
  node_id     uuid        not null references nodes(id) on delete restrict,
  percentage  int         not null check (percentage between 0 and 100),
  source      knowledge_source not null,
  updated_at  timestamptz not null default now(),
  constraint user_node_knowledge_unique unique (user_id, node_id)
);

comment on table  user_node_knowledge is 'A users assessed knowledge for a node. Unassessed nodes simply have no row and count as 0%% in aggregates (PRD §04/§10.1).';
comment on column user_node_knowledge.source is 'tested = LLM-verified, self_reported = user marked known, predicted = inferred from import (PRD §10.2).';

create trigger trg_user_node_knowledge_updated_at
  before update on user_node_knowledge
  for each row execute function set_updated_at();


-- ============================================================================
-- test_sessions
-- Per-node, per-user test history. Current percentage reflects the most recent.
-- ============================================================================

create table test_sessions (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references users(id) on delete cascade,
  node_id       uuid        not null references nodes(id) on delete restrict,
  questions     jsonb       not null,        -- array of question objects with options
  answers       jsonb       not null,        -- user's selected answers
  score         int         not null check (score between 0 and 100),
  llm_feedback  jsonb,                        -- per-question explanations for wrong answers (optional)
  created_at    timestamptz not null default now()
);

comment on table test_sessions is 'LLM-powered test of an L5 node (subscribers only). 4 MCQs generated and scored by the LLM (PRD §09.2).';


-- ============================================================================
-- user_notes
-- Private per-node notes. Never visible to other users or admins (PRD §10.3).
-- ============================================================================

create table user_notes (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references users(id) on delete cascade,
  node_id     uuid        not null references nodes(id) on delete restrict,
  content     text        not null,
  updated_at  timestamptz not null default now(),
  constraint user_notes_unique unique (user_id, node_id)
);

comment on table user_notes is 'Private note attached to a node. Never visible to other users or admins; syncs across devices (PRD §10.3).';

create trigger trg_user_notes_updated_at
  before update on user_notes
  for each row execute function set_updated_at();


-- ============================================================================
-- knowledge_imports
-- One-time (re-runnable) education + work import; LLM predicts node knowledge.
-- ============================================================================

create table knowledge_imports (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references users(id) on delete cascade,
  education   jsonb       not null,        -- array of education entries
  work        jsonb       not null,        -- array of work entries
  llm_output  jsonb,                        -- raw LLM prediction before applying
  applied_at  timestamptz                   -- set when predictions are applied to user_node_knowledge
);

comment on table  knowledge_imports is 'Education/work background sent to the LLM; predictions modulated by the Ebbinghaus forgetting curve. Decay is not user-overridable (PRD §09.3).';
comment on column knowledge_imports.llm_output is 'Raw LLM prediction payload retained before it is applied to user_node_knowledge.';


-- ============================================================================
-- suggestions
-- User-submitted changes landing in the admin review queue. Never auto-applied.
-- ============================================================================

create table suggestions (
  id           uuid              primary key default gen_random_uuid(),
  user_id      uuid              references users(id) on delete set null,  -- nullable: see design note 3
  node_id      uuid              references nodes(id) on delete restrict,  -- null if suggesting a new node
  type         text              not null,        -- new_node | edit_label | new_edge | correction
  content      text              not null,
  status       suggestion_status not null default 'pending',
  admin_note   text,
  reviewed_by  uuid              references users(id) on delete set null,
  reviewed_at  timestamptz,
  created_at   timestamptz       not null default now()
);

comment on table  suggestions is 'User suggestion in the admin review queue. Approve / reject-with-note / request-clarification; never auto-applied (PRD §08.4).';
comment on column suggestions.type    is 'Free text per PRD. Known values: new_node, edit_label, new_edge, correction.';
comment on column suggestions.node_id is 'Null when proposing an entirely new node.';
comment on column suggestions.user_id is 'Null if the suggesting user has since deleted their account; the suggestion record is retained.';


-- ============================================================================
-- share_links
-- Shareable, revocable links to a users live personal map (PRD §11.1).
-- ============================================================================

create table share_links (
  id           uuid             primary key default gen_random_uuid(),
  user_id      uuid             not null references users(id) on delete cascade,
  token        text             not null unique,    -- URL-safe random token
  access_type  share_access_type not null,
  expires_at   timestamptz,                          -- required for 'expiring'; null otherwise
  view_count   int              not null default 0,
  is_revoked   boolean          not null default false,
  created_at   timestamptz      not null default now(),
  constraint share_links_expiry_required
    check (access_type <> 'expiring' or expires_at is not null)
);

comment on table  share_links is 'one_time expires after first view; expiring has a deadline; permanent gives ongoing access until revoked. Shows live state, not a snapshot (PRD §11.1).';
comment on column share_links.expires_at is 'Required when access_type = expiring; null for one_time and permanent.';


-- ============================================================================
-- achievements
-- Auto-generated shareable milestones (PRD §11.2).
-- ============================================================================

create table achievements (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references users(id) on delete cascade,
  achievement_type  text        not null,        -- e.g. first_test, domain_50, 100_nodes
  metadata          jsonb       not null default '{}'::jsonb,  -- context for card generation
  achieved_at       timestamptz not null default now()
);

comment on column achievements.achievement_type is 'Free text per PRD. Examples: first_test, domain_50, 100_nodes, l2_branch_complete, perfect_score.';


-- ============================================================================
-- learning_paths                                                  [POST-MVP]
-- Schema present from day one per PRD §10.4 / §17.
-- ============================================================================

create table learning_paths (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references users(id) on delete cascade,
  name          text        not null,            -- user-given name
  goal_node_id  uuid        not null references nodes(id) on delete restrict,
  path_nodes    jsonb       not null,            -- ordered array of node ids with estimated effort
  generated_at  timestamptz not null default now(),
  is_stale      boolean     not null default false
);

comment on table  learning_paths is 'POST-MVP. LLM-generated prerequisite sequence toward a goal node (PRD §10.4).';
comment on column learning_paths.is_stale is 'Flagged true when the users knowledge state changes after generation.';


-- ============================================================================
-- llm_usage_log
-- Per-call cost/usage accounting (PRD §13).
-- ============================================================================

create table llm_usage_log (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        references users(id) on delete set null,  -- nullable: retained for accounting, see design note 3
  call_type      text        not null,        -- test_generate | test_score | import | path_generate
  input_tokens   int         not null,
  output_tokens  int         not null,
  model          text        not null,
  created_at     timestamptz not null default now()
);

comment on table  llm_usage_log is 'One row per LLM call. Supports cost monitoring and future quota enforcement (PRD §13).';
comment on column llm_usage_log.call_type is 'Free text per PRD. Known values: test_generate, test_score, import, path_generate.';
comment on column llm_usage_log.user_id   is 'Null if the user was deleted; the usage record is retained for accounting.';


-- ============================================================================
-- INDEXES
-- Postgres auto-indexes PKs and UNIQUE constraints but NOT foreign keys.
-- These cover the main query paths described in the PRD.
-- ============================================================================

-- Map structure / traversal
create index idx_nodes_layer_id        on nodes (layer_id);
create index idx_nodes_level           on nodes (level);
create index idx_nodes_active          on nodes (is_active) where is_active;
create index idx_edges_source          on edges (source_node_id);
create index idx_edges_target          on edges (target_node_id);  -- reverse / knowledge->careers traversal
create index idx_edges_type            on edges (edge_type);

-- Personal map lookups
create index idx_unk_node              on user_node_knowledge (node_id);          -- "who knows this node"
create index idx_test_sessions_user_node on test_sessions (user_id, node_id, created_at desc);
create index idx_knowledge_imports_user on knowledge_imports (user_id);

-- Admin queue
create index idx_suggestions_status    on suggestions (status) where status = 'pending';
create index idx_suggestions_user      on suggestions (user_id);

-- Sharing / achievements
create index idx_share_links_user      on share_links (user_id);
create index idx_share_links_active    on share_links (user_id) where not is_revoked;
create index idx_achievements_user     on achievements (user_id);

-- Post-MVP + accounting
create index idx_learning_paths_user   on learning_paths (user_id);
create index idx_llm_usage_user_time   on llm_usage_log (user_id, created_at desc);
create index idx_llm_usage_time        on llm_usage_log (created_at desc);         -- global cost reports

-- ============================================================================
-- End of schema
-- ============================================================================
