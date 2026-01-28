-- Migration: 004_push_subscriptions
-- Push notification subscriptions for PWA

-- ============================================================================
-- TABLE
-- ============================================================================

CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One subscription per endpoint per user
  UNIQUE(profile_id, endpoint)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_push_subscriptions_profile ON push_subscriptions(profile_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscriptions
CREATE POLICY push_subscriptions_select ON push_subscriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = profile_id
        AND p.user_id = (SELECT auth.uid())::TEXT
    )
  );

-- Users can insert their own subscriptions
CREATE POLICY push_subscriptions_insert ON push_subscriptions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = profile_id
        AND p.user_id = (SELECT auth.uid())::TEXT
    )
  );

-- Users can update their own subscriptions
CREATE POLICY push_subscriptions_update ON push_subscriptions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = profile_id
        AND p.user_id = (SELECT auth.uid())::TEXT
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = profile_id
        AND p.user_id = (SELECT auth.uid())::TEXT
    )
  );

-- Users can delete their own subscriptions
CREATE POLICY push_subscriptions_delete ON push_subscriptions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = profile_id
        AND p.user_id = (SELECT auth.uid())::TEXT
    )
  );
