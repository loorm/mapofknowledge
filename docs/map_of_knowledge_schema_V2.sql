-- ============================================================================
-- Map of Knowledge — Database Schema V2
-- Target  : MariaDB / MySQL (zone.ee)
-- Created : 2026-06-03
--
-- 24 tables across four concerns:
--   1. Users & authentication       (users, oauth_identities, user_settings, notifications)
--   2. Learner passport             (learner_passports + 10 passport_* tables)
--   3. Knowledge map & learning     (nodes, edges, knobits, knobit_progress,
--                                    knobit_interactions, llm_usage_log)
--   4. Knowledge subsets / filters  (knowledge_subsets, knowledge_subset_nodes)
--
-- Design decisions:
--   - BIGINT UNSIGNED AUTO_INCREMENT PKs throughout (no UUIDs — poor index
--     performance in MySQL at scale)
--   - public_id CHAR(36) on learner_passports only, for external sharing/export
--   - No JSON columns — all structure is explicit
--   - knobit_progress is the sole record of learner progress; node completion
--     is derived by querying knobit_progress (no denormalised summary table)
--   - knobits have a locale column — one row per language per knobit
--   - passport_* tables all hang off passport_id; passport travels with the
--     learner independently of the user account
-- ============================================================================


-- ============================================================================
-- 1. USERS
-- ============================================================================

CREATE TABLE users (
  id                      BIGINT UNSIGNED     NOT NULL AUTO_INCREMENT,
  email                   VARCHAR(255)        NOT NULL,
  password_hash           VARCHAR(255)            NULL, -- NULL for SSO-only accounts
  role                    ENUM('learner','teacher','admin','super_admin')
                                              NOT NULL DEFAULT 'learner',
  locale                  VARCHAR(10)         NOT NULL DEFAULT 'et',
  passport_id             BIGINT UNSIGNED         NULL,
  subscription_status     ENUM('free','subscriber','cancelled')
                                              NOT NULL DEFAULT 'free',
  subscription_period_end DATETIME                NULL,
  created_at              DATETIME            NOT NULL DEFAULT NOW(),
  last_login              DATETIME                NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
);


-- ============================================================================
-- 2. OAUTH IDENTITIES
-- One row per provider per user. A user can have both local auth and one or
-- more SSO providers linked to the same account.
-- ============================================================================

CREATE TABLE oauth_identities (
  id             BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  user_id        BIGINT UNSIGNED  NOT NULL,
  provider       ENUM('google')   NOT NULL, -- extend enum as providers are added
  provider_id    VARCHAR(255)     NOT NULL, -- Google's 'sub' claim
  provider_email VARCHAR(255)         NULL,
  linked_at      DATETIME         NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  UNIQUE KEY uq_oauth_provider (provider, provider_id),
  CONSTRAINT fk_oauth_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);


-- ============================================================================
-- 3. LEARNER PASSPORT — core record
-- ============================================================================

CREATE TABLE learner_passports (
  id                  BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  public_id           CHAR(36)         NOT NULL,
  display_name        VARCHAR(255)         NULL,
  pronouns            VARCHAR(50)          NULL,
  birth_year          SMALLINT             NULL,
  location            VARCHAR(255)         NULL,
  cultural_background VARCHAR(255)         NULL,
  tagline             VARCHAR(255)         NULL,
  about               TEXT                 NULL,
  created_at          DATETIME         NOT NULL DEFAULT NOW(),
  updated_at          DATETIME         NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  UNIQUE KEY uq_passport_public_id (public_id)
);

-- Wire the FK now that both tables exist
ALTER TABLE users
  ADD CONSTRAINT fk_users_passport
  FOREIGN KEY (passport_id) REFERENCES learner_passports (id)
  ON DELETE SET NULL;


-- ============================================================================
-- 3. PASSPORT — learning style
-- One row per passport (1-to-1), kept separate to avoid wide rows.
-- ============================================================================

CREATE TABLE passport_learning_style (
  id             BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  passport_id    BIGINT UNSIGNED  NOT NULL,
  modalities     VARCHAR(255)         NULL,
  peak_time      VARCHAR(100)         NULL,
  session_length VARCHAR(100)         NULL,
  works_best     TEXT                 NULL,
  needs          TEXT                 NULL,
  accessibility  VARCHAR(255)         NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pls_passport (passport_id),
  CONSTRAINT fk_pls_passport
    FOREIGN KEY (passport_id) REFERENCES learner_passports (id)
    ON DELETE CASCADE
);


-- ============================================================================
-- 4. PASSPORT — interests & values (tags)
-- ============================================================================

CREATE TABLE passport_tags (
  id          BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  passport_id BIGINT UNSIGNED  NOT NULL,
  type        ENUM('interest','value') NOT NULL,
  text        VARCHAR(255)     NOT NULL,
  sort_order  TINYINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  CONSTRAINT fk_ptags_passport
    FOREIGN KEY (passport_id) REFERENCES learner_passports (id)
    ON DELETE CASCADE
);


-- ============================================================================
-- 5. PASSPORT — learning events
-- ============================================================================

CREATE TABLE passport_events (
  id          BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  passport_id BIGINT UNSIGNED  NOT NULL,
  event_date  DATE                 NULL,
  title       VARCHAR(255)     NOT NULL,
  institution VARCHAR(255)         NULL,
  result      VARCHAR(255)         NULL,
  type        ENUM('activity','assessment','evidence') NOT NULL,
  sort_order  SMALLINT         NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  CONSTRAINT fk_pevents_passport
    FOREIGN KEY (passport_id) REFERENCES learner_passports (id)
    ON DELETE CASCADE
);


-- ============================================================================
-- 6. PASSPORT — reflections
-- ============================================================================

CREATE TABLE passport_reflections (
  id          BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  passport_id BIGINT UNSIGNED  NOT NULL,
  text        TEXT             NOT NULL,
  created_at  DATETIME         NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  CONSTRAINT fk_prefl_passport
    FOREIGN KEY (passport_id) REFERENCES learner_passports (id)
    ON DELETE CASCADE
);


-- ============================================================================
-- 7. PASSPORT — relationships (individuals, groups, institutions, tools)
-- ============================================================================

CREATE TABLE passport_relationships (
  id               BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  passport_id      BIGINT UNSIGNED  NOT NULL,
  type             ENUM('individual','group','institution','tool') NOT NULL,
  name             VARCHAR(255)     NOT NULL,
  role_description VARCHAR(500)         NULL,
  status           ENUM('active','concluded') NULL,
  is_primary       TINYINT(1)       NOT NULL DEFAULT 0,
  sort_order       SMALLINT         NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  CONSTRAINT fk_prelations_passport
    FOREIGN KEY (passport_id) REFERENCES learner_passports (id)
    ON DELETE CASCADE
);


-- ============================================================================
-- 8. PASSPORT — credentials
-- Covers platform badges, qualifications, certifications, awards.
-- ============================================================================

CREATE TABLE passport_credentials (
  id              BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  passport_id     BIGINT UNSIGNED  NOT NULL,
  type            ENUM('platform','qualification','certification','award') NOT NULL,
  title           VARCHAR(255)     NOT NULL,
  issuer          VARCHAR(255)         NULL,
  awarded_date    DATE                 NULL,
  grade           VARCHAR(100)         NULL,
  score_pct       TINYINT UNSIGNED     NULL,
  threshold_pct   TINYINT UNSIGNED     NULL,
  blockchain_hash VARCHAR(255)         NULL,
  verify_url      VARCHAR(500)         NULL,
  sort_order      SMALLINT         NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  CONSTRAINT fk_pcreds_passport
    FOREIGN KEY (passport_id) REFERENCES learner_passports (id)
    ON DELETE CASCADE
);


-- ============================================================================
-- 9. PASSPORT — competence (knowledge domains, skills, languages)
-- level    : 1–5 dot rating; for languages maps loosely to A1–C2
-- proficiency_label : human-readable level label ('Native', 'C2', 'B1' etc.)
-- ============================================================================

CREATE TABLE passport_competence (
  id                BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  passport_id       BIGINT UNSIGNED  NOT NULL,
  type              ENUM('knowledge','skill','language') NOT NULL,
  name              VARCHAR(255)     NOT NULL,
  description       TEXT                 NULL,
  level             TINYINT UNSIGNED NOT NULL,
  proficiency_label VARCHAR(20)          NULL,
  source            ENUM('tested','self_reported','predicted')
                                     NOT NULL DEFAULT 'self_reported',
  sort_order        SMALLINT         NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  CONSTRAINT fk_pcomp_passport
    FOREIGN KEY (passport_id) REFERENCES learner_passports (id)
    ON DELETE CASCADE
);


-- ============================================================================
-- 10. PASSPORT — aspirations
-- ============================================================================

CREATE TABLE passport_aspirations (
  id          BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  passport_id BIGINT UNSIGNED  NOT NULL,
  text        TEXT             NOT NULL,
  sort_order  TINYINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  CONSTRAINT fk_pasps_passport
    FOREIGN KEY (passport_id) REFERENCES learner_passports (id)
    ON DELETE CASCADE
);


-- ============================================================================
-- 11. PASSPORT — objectives
-- ============================================================================

CREATE TABLE passport_objectives (
  id                 BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  passport_id        BIGINT UNSIGNED  NOT NULL,
  title              VARCHAR(255)     NOT NULL,
  target_date        DATE                 NULL,
  target_description VARCHAR(500)         NULL,
  status             ENUM('active','completed') NOT NULL DEFAULT 'active',
  sort_order         SMALLINT         NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  CONSTRAINT fk_pobjs_passport
    FOREIGN KEY (passport_id) REFERENCES learner_passports (id)
    ON DELETE CASCADE
);


-- ============================================================================
-- 12. PASSPORT — plans
-- ============================================================================

CREATE TABLE passport_plans (
  id          BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  passport_id BIGINT UNSIGNED  NOT NULL,
  frequency   VARCHAR(50)      NOT NULL,
  title       VARCHAR(255)     NOT NULL,
  description TEXT                 NULL,
  sort_order  SMALLINT         NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  CONSTRAINT fk_pplans_passport
    FOREIGN KEY (passport_id) REFERENCES learner_passports (id)
    ON DELETE CASCADE
);


-- ============================================================================
-- 13. NODES — knowledge map
-- Permanent: nodes are never deleted, only deactivated.
-- external_id preserves original JSON IDs ('1234', 'E042') during import.
-- ============================================================================

CREATE TABLE nodes (
  id          BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  external_id VARCHAR(20)          NULL,
  label       VARCHAR(255)     NOT NULL,
  level       TINYINT UNSIGNED NOT NULL,
  layer       ENUM('foundational','emergent') NOT NULL,
  parent_id   BIGINT UNSIGNED      NULL,
  is_active   TINYINT(1)       NOT NULL DEFAULT 1,
  created_at  DATETIME         NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  UNIQUE KEY uq_nodes_external_id (external_id),
  CONSTRAINT fk_nodes_parent
    FOREIGN KEY (parent_id) REFERENCES nodes (id)
    ON DELETE RESTRICT
);


-- ============================================================================
-- 14. EDGES — hierarchy and cross-layer connections
-- ============================================================================

CREATE TABLE edges (
  id             BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  source_node_id BIGINT UNSIGNED  NOT NULL,
  target_node_id BIGINT UNSIGNED  NOT NULL,
  edge_type      ENUM('hierarchy','cross_layer','draws_from') NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_edges (source_node_id, target_node_id, edge_type),
  CONSTRAINT fk_edges_source
    FOREIGN KEY (source_node_id) REFERENCES nodes (id) ON DELETE RESTRICT,
  CONSTRAINT fk_edges_target
    FOREIGN KEY (target_node_id) REFERENCES nodes (id) ON DELETE RESTRICT
);


-- ============================================================================
-- 15. KNOBITS — learning content per node per locale
-- content_* columns hold structured text; format TBD when LLM pipeline is built.
-- ============================================================================

CREATE TABLE knobits (
  id                  BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  node_id             BIGINT UNSIGNED  NOT NULL,
  sequence            TINYINT UNSIGNED NOT NULL,
  locale              VARCHAR(10)      NOT NULL,
  title               VARCHAR(255)     NOT NULL,
  content_explain     TEXT                 NULL,
  content_demonstrate TEXT                 NULL,
  content_practice    TEXT                 NULL,
  content_meaning     TEXT                 NULL,
  created_at          DATETIME         NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  UNIQUE KEY uq_knobits (node_id, sequence, locale),
  CONSTRAINT fk_knobits_node
    FOREIGN KEY (node_id) REFERENCES nodes (id) ON DELETE RESTRICT
);


-- ============================================================================
-- 16. KNOBIT PROGRESS — per-learner progress through knobits
-- Node-level completion is derived: a node is done when all its knobits
-- for the relevant locale have phase_reached = 'done'.
-- ============================================================================

CREATE TABLE knobit_progress (
  id             BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  passport_id    BIGINT UNSIGNED  NOT NULL,
  knobit_id      BIGINT UNSIGNED  NOT NULL,
  phase_reached  ENUM('explain','demonstrate','practice','meaning','done')
                                  NOT NULL,
  assess_correct TINYINT(1)           NULL,
  completed_at   DATETIME             NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_knobit_progress (passport_id, knobit_id),
  CONSTRAINT fk_kprog_passport
    FOREIGN KEY (passport_id) REFERENCES learner_passports (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_kprog_knobit
    FOREIGN KEY (knobit_id) REFERENCES knobits (id)
    ON DELETE RESTRICT
);


-- ============================================================================
-- 17. USER SETTINGS
-- Key-value store for per-user preferences. Extensible without schema changes.
-- ============================================================================

CREATE TABLE user_settings (
  id         BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED  NOT NULL,
  key_name   VARCHAR(100)     NOT NULL,
  value      VARCHAR(500)     NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_user_settings (user_id, key_name),
  CONSTRAINT fk_usettings_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Known keys (add as settings are built):
--   screensaver_enabled   '1' | '0'
--   default_locale        e.g. 'et', 'en'


-- ============================================================================
-- 18. NOTIFICATIONS
-- ============================================================================

CREATE TABLE notifications (
  id         BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED  NOT NULL,
  type       ENUM('achievement','content','resume','system') NOT NULL,
  title      VARCHAR(255)     NOT NULL,
  body       TEXT                 NULL,
  is_read    TINYINT(1)       NOT NULL DEFAULT 0,
  created_at DATETIME         NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  CONSTRAINT fk_notif_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);


-- ============================================================================
-- 19. KNOBIT INTERACTIONS
-- Full interaction log within a knobit session. Supports mid-knobit resume,
-- LLM context reconstruction, and learning analytics.
-- ============================================================================

CREATE TABLE knobit_interactions (
  id          BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  passport_id BIGINT UNSIGNED  NOT NULL,
  knobit_id   BIGINT UNSIGNED  NOT NULL,
  phase       ENUM('explain','demonstrate','practice','meaning') NOT NULL,
  block_type  ENUM('byte','example','practice','feedback','meaning','user','note') NOT NULL,
  block_index TINYINT UNSIGNED NOT NULL,   -- position within phase (byte 1, example 2, etc.)
  choice_made VARCHAR(50)          NULL,   -- 'ok','no','simple','complex','next','done' etc.
  answer_text TEXT                 NULL,   -- learner's free-text practice answer
  created_at  DATETIME         NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  CONSTRAINT fk_kint_passport
    FOREIGN KEY (passport_id) REFERENCES learner_passports (id) ON DELETE CASCADE,
  CONSTRAINT fk_kint_knobit
    FOREIGN KEY (knobit_id) REFERENCES knobits (id) ON DELETE RESTRICT
);


-- ============================================================================
-- 20. LLM USAGE LOG
-- One row per API call. Supports cost monitoring and future quota enforcement.
-- ============================================================================

CREATE TABLE llm_usage_log (
  id            BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  user_id       BIGINT UNSIGNED      NULL,  -- NULL if user deleted; retained for accounting
  call_type     ENUM('byte','rephrase','practice_feedback','ask','import','path_generate') NOT NULL,
  input_tokens  INT UNSIGNED     NOT NULL,
  output_tokens INT UNSIGNED     NOT NULL,
  model         VARCHAR(100)     NOT NULL,
  created_at    DATETIME         NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  CONSTRAINT fk_llm_user
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);


-- ============================================================================
-- 21. KNOWLEDGE SUBSETS
-- Named node collections for the filter panel. type='system' for built-in
-- curricula (Estonian Main School, etc.); type='user' for learner-created sets.
-- 'My Knowledge' is computed from passport_competence, not stored here.
-- ============================================================================

CREATE TABLE knowledge_subsets (
  id          BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
  name        VARCHAR(255)     NOT NULL,
  description TEXT                 NULL,
  type        ENUM('system','user') NOT NULL DEFAULT 'system',
  created_by  BIGINT UNSIGNED      NULL,    -- NULL for system subsets
  locale      VARCHAR(10)      NOT NULL DEFAULT 'et',
  is_active   TINYINT(1)       NOT NULL DEFAULT 1,
  created_at  DATETIME         NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id),
  CONSTRAINT fk_ksub_creator
    FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
);


-- ============================================================================
-- 22. KNOWLEDGE SUBSET NODES
-- Join table: which nodes belong to each subset.
-- Replaces the hardcoded label sets in js/filters.js.
-- ============================================================================

CREATE TABLE knowledge_subset_nodes (
  subset_id BIGINT UNSIGNED NOT NULL,
  node_id   BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (subset_id, node_id),
  CONSTRAINT fk_ksubnode_subset
    FOREIGN KEY (subset_id) REFERENCES knowledge_subsets (id) ON DELETE CASCADE,
  CONSTRAINT fk_ksubnode_node
    FOREIGN KEY (node_id) REFERENCES nodes (id) ON DELETE RESTRICT
);


-- ============================================================================
-- INDEXES
-- PKs and UNIQUE keys are indexed automatically.
-- These cover the main query paths.
-- ============================================================================

-- Passport lookups
CREATE INDEX idx_passport_tags_passport        ON passport_tags (passport_id, type);
CREATE INDEX idx_passport_events_passport      ON passport_events (passport_id, event_date DESC);
CREATE INDEX idx_passport_competence_passport  ON passport_competence (passport_id, type);
CREATE INDEX idx_passport_credentials_passport ON passport_credentials (passport_id, type);

-- Map traversal
CREATE INDEX idx_nodes_parent                  ON nodes (parent_id);
CREATE INDEX idx_nodes_layer_level             ON nodes (layer, level);
CREATE INDEX idx_nodes_active                  ON nodes (is_active);
CREATE INDEX idx_edges_source                  ON edges (source_node_id);
CREATE INDEX idx_edges_target                  ON edges (target_node_id);

-- Learning
CREATE INDEX idx_knobits_node_locale           ON knobits (node_id, locale);
CREATE INDEX idx_knobit_progress_passport      ON knobit_progress (passport_id);
CREATE INDEX idx_knobit_progress_knobit        ON knobit_progress (knobit_id);
CREATE INDEX idx_knobit_interactions_passport  ON knobit_interactions (passport_id, knobit_id);
CREATE INDEX idx_llm_usage_user_time           ON llm_usage_log (user_id, created_at DESC);
CREATE INDEX idx_llm_usage_time                ON llm_usage_log (created_at DESC);

-- Notifications
CREATE INDEX idx_notifications_user_read       ON notifications (user_id, is_read, created_at DESC);

-- Subsets
CREATE INDEX idx_ksub_type_active              ON knowledge_subsets (type, is_active);
CREATE INDEX idx_ksubnode_node                 ON knowledge_subset_nodes (node_id);

-- ============================================================================
-- End of schema V2
-- ============================================================================
