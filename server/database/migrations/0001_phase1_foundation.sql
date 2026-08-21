CREATE TYPE xrpl_network AS ENUM ('testnet', 'mainnet');
CREATE TYPE session_status AS ENUM ('active', 'expired', 'revoked');
CREATE TYPE transaction_status AS ENUM (
  'CREATED',
  'AWAITING_SIGNATURE',
  'SIGNING',
  'SIGNED',
  'SUBMITTING',
  'SUBMITTED',
  'VALIDATING',
  'VALIDATED',
  'FAILED',
  'EXPIRED',
  'CANCELLED',
  'REJECTED'
);

CREATE TABLE wallet_sessions (
  id UUID PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  wallet_provider TEXT NOT NULL,
  network xrpl_network NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status session_status NOT NULL DEFAULT 'active'
);

CREATE TABLE transaction_intents (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES wallet_sessions(id),
  network xrpl_network NOT NULL,
  transaction_type TEXT NOT NULL,
  status transaction_status NOT NULL DEFAULT 'CREATED',
  intent_fingerprint TEXT NOT NULL UNIQUE,
  unsigned_transaction JSONB,
  signed_transaction_hash TEXT,
  xrpl_engine_result TEXT,
  xrpl_ledger_index BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE transaction_state_transitions (
  id UUID PRIMARY KEY,
  transaction_intent_id UUID NOT NULL REFERENCES transaction_intents(id),
  from_status transaction_status,
  to_status transaction_status NOT NULL,
  reason TEXT,
  request_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_events (
  id UUID PRIMARY KEY,
  request_id TEXT,
  session_id UUID REFERENCES wallet_sessions(id),
  transaction_intent_id UUID REFERENCES transaction_intents(id),
  event_type TEXT NOT NULL,
  event_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

