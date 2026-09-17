"""schema iniziale

Revision ID: 715319c182ff
Revises: 
Create Date: 2026-09-16 14:14:35.907816
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
import pgvector.sqlalchemy
from sqlalchemy.dialects import postgresql

revision = '715319c182ff'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.create_table('citations',
    sa.Column('id', sa.String(length=32), nullable=False),
    sa.Column('doi', sa.String(length=255), nullable=False),
    sa.Column('authors', sa.String(length=512), nullable=False),
    sa.Column('year', sa.Integer(), nullable=False),
    sa.Column('title', sa.Text(), nullable=False),
    sa.Column('journal', sa.String(length=255), nullable=False),
    sa.Column('type', sa.String(length=32), nullable=False),
    sa.Column('open_access', sa.Boolean(), nullable=False),
    sa.Column('url', sa.String(length=512), nullable=False),
    sa.Column('verified_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('verified_title', sa.Text(), nullable=False),
    sa.Column('verified_via', sa.String(length=32), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('doi')
    )
    op.create_table('corpus_chunks',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('doc_id', sa.String(length=64), nullable=False),
    sa.Column('kind', sa.String(length=24), nullable=False),
    sa.Column('title_it', sa.String(length=200), nullable=False),
    sa.Column('text_it', sa.Text(), nullable=False),
    sa.Column('citation_ids', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('rule_ids', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('embedding', pgvector.sqlalchemy.vector.VECTOR(dim=1536), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_corpus_chunks_doc_id'), 'corpus_chunks', ['doc_id'], unique=False)
    op.execute("CREATE INDEX ix_corpus_chunks_embedding_hnsw ON corpus_chunks USING hnsw (embedding vector_cosine_ops)")
    op.execute("CREATE INDEX ix_corpus_chunks_fts ON corpus_chunks USING gin (to_tsvector('italian', title_it || ' ' || text_it))")
    op.create_table('exercises',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('name_it', sa.String(length=120), nullable=False),
    sa.Column('name_en', sa.String(length=120), nullable=False),
    sa.Column('pattern', sa.String(length=24), nullable=False),
    sa.Column('primary_muscle', sa.String(length=24), nullable=False),
    sa.Column('secondary_muscles', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('equipment', sa.String(length=24), nullable=False),
    sa.Column('mechanic', sa.String(length=12), nullable=False),
    sa.Column('spinal_load', sa.String(length=8), nullable=False),
    sa.Column('min_tier', sa.String(length=16), nullable=False),
    sa.Column('requires', sa.String(length=24), nullable=True),
    sa.Column('instructions_it', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('gif_url', sa.String(length=512), nullable=True),
    sa.Column('poster_url', sa.String(length=512), nullable=True),
    sa.Column('attribution', sa.String(length=255), nullable=True),
    sa.Column('source', sa.String(length=64), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('rules',
    sa.Column('id', sa.String(length=96), nullable=False),
    sa.Column('version', sa.Integer(), nullable=False),
    sa.Column('governs', sa.String(length=255), nullable=False),
    sa.Column('applies_to', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('value', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('grade', sa.String(length=1), nullable=True),
    sa.Column('citation_ids', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('title_it', sa.String(length=80), nullable=False),
    sa.Column('summary_it', sa.Text(), nullable=False),
    sa.Column('not_says_it', sa.Text(), nullable=False),
    sa.Column('is_own_note', sa.Boolean(), nullable=False),
    sa.Column('rationale_it', sa.Text(), nullable=True),
    sa.Column('updated_at', sa.Date(), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('stripe_events',
    sa.Column('id', sa.String(length=64), nullable=False),
    sa.Column('type', sa.String(length=64), nullable=False),
    sa.Column('processed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('users',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('email', sa.String(length=320), nullable=False),
    sa.Column('password_hash', sa.String(length=255), nullable=False),
    sa.Column('email_verified', sa.Boolean(), nullable=False),
    sa.Column('terms_accepted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('pwa_installed_reported', sa.Boolean(), nullable=False),
    sa.Column('stripe_customer_id', sa.String(length=64), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('email'),
    sa.UniqueConstraint('stripe_customer_id')
    )
    op.create_table('chat_messages',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('role', sa.String(length=8), nullable=False),
    sa.Column('kind', sa.String(length=12), nullable=False),
    sa.Column('status', sa.String(length=8), nullable=False),
    sa.Column('text', sa.Text(), nullable=False),
    sa.Column('blocks', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('notes', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('protocol', sa.String(length=24), nullable=True),
    sa.Column('client_op_id', sa.String(length=64), nullable=True),
    sa.Column('reply_to_id', sa.UUID(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'client_op_id', name='uq_chat_client_op')
    )
    op.create_index('ix_chat_messages_user_created', 'chat_messages', ['user_id', 'created_at'], unique=False)
    op.create_index(op.f('ix_chat_messages_user_id'), 'chat_messages', ['user_id'], unique=False)
    op.create_table('data_exports',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('token_hash', sa.String(length=64), nullable=False),
    sa.Column('payload', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('token_hash')
    )
    op.create_index(op.f('ix_data_exports_user_id'), 'data_exports', ['user_id'], unique=False)
    op.create_table('email_log',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=True),
    sa.Column('to_email', sa.String(length=320), nullable=False),
    sa.Column('kind', sa.String(length=32), nullable=False),
    sa.Column('subject', sa.String(length=255), nullable=False),
    sa.Column('provider_id', sa.String(length=128), nullable=True),
    sa.Column('sent_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_email_log_user_id'), 'email_log', ['user_id'], unique=False)
    op.create_table('entitlements',
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('plan', sa.String(length=8), nullable=False),
    sa.Column('source', sa.String(length=8), nullable=False),
    sa.Column('valid_until', sa.DateTime(timezone=True), nullable=True),
    sa.Column('grace_until', sa.DateTime(timezone=True), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('user_id')
    )
    op.create_table('events',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=True),
    sa.Column('name', sa.String(length=48), nullable=False),
    sa.Column('props', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('source', sa.String(length=8), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_events_name'), 'events', ['name'], unique=False)
    op.create_index(op.f('ix_events_user_id'), 'events', ['user_id'], unique=False)
    op.create_table('llm_usage',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('message_id', sa.UUID(), nullable=True),
    sa.Column('provider', sa.String(length=16), nullable=False),
    sa.Column('model', sa.String(length=64), nullable=False),
    sa.Column('turn_kind', sa.String(length=12), nullable=False),
    sa.Column('tokens_in', sa.Integer(), nullable=False),
    sa.Column('tokens_out', sa.Integer(), nullable=False),
    sa.Column('tokens_cache_read', sa.Integer(), nullable=False),
    sa.Column('tokens_cache_write', sa.Integer(), nullable=False),
    sa.Column('cost_usd', sa.Numeric(precision=10, scale=6), nullable=False),
    sa.Column('success', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_llm_usage_user_id'), 'llm_usage', ['user_id'], unique=False)
    op.create_table('mesocycles',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('index', sa.Integer(), nullable=False),
    sa.Column('status', sa.String(length=16), nullable=False),
    sa.Column('split', sa.String(length=16), nullable=False),
    sa.Column('tier', sa.String(length=16), nullable=False),
    sa.Column('total_weeks', sa.Integer(), nullable=False),
    sa.Column('started_on', sa.Date(), nullable=False),
    sa.Column('engine_version', sa.String(length=16), nullable=False),
    sa.Column('rules_snapshot', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('summary_shown_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'index', name='uq_mesocycle_user_index')
    )
    op.create_index(op.f('ix_mesocycles_user_id'), 'mesocycles', ['user_id'], unique=False)
    op.create_table('one_time_tokens',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('purpose', sa.String(length=32), nullable=False),
    sa.Column('token_hash', sa.String(length=64), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('token_hash')
    )
    op.create_index(op.f('ix_one_time_tokens_user_id'), 'one_time_tokens', ['user_id'], unique=False)
    op.create_table('profiles',
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('goal', sa.String(length=16), nullable=False),
    sa.Column('level', sa.String(length=16), nullable=False),
    sa.Column('days_per_week', sa.Integer(), nullable=False),
    sa.Column('minutes_per_session', sa.Integer(), nullable=False),
    sa.Column('location', sa.String(length=16), nullable=False),
    sa.Column('equipment', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('health_consent_given', sa.Boolean(), nullable=False),
    sa.Column('health_consent_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('constraints_text', sa.Text(), nullable=True),
    sa.Column('avoid_patterns', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('safety_answers', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('safety_flagged', sa.Boolean(), nullable=False),
    sa.Column('conservative', sa.Boolean(), nullable=False),
    sa.Column('onboarding_completed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('user_id')
    )
    op.create_table('refresh_tokens',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('token_hash', sa.String(length=64), nullable=False),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('token_hash')
    )
    op.create_index(op.f('ix_refresh_tokens_user_id'), 'refresh_tokens', ['user_id'], unique=False)
    op.create_table('subscriptions',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('stripe_customer_id', sa.String(length=64), nullable=False),
    sa.Column('stripe_subscription_id', sa.String(length=64), nullable=False),
    sa.Column('price_key', sa.String(length=16), nullable=False),
    sa.Column('status', sa.String(length=24), nullable=False),
    sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('current_period_end', sa.DateTime(timezone=True), nullable=True),
    sa.Column('cancel_at_period_end', sa.Boolean(), nullable=False),
    sa.Column('latest_invoice_id', sa.String(length=64), nullable=True),
    sa.Column('latest_payment_intent_id', sa.String(length=64), nullable=True),
    sa.Column('amount_cents', sa.Integer(), nullable=True),
    sa.Column('currency', sa.String(length=3), nullable=True),
    sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('stripe_subscription_id')
    )
    op.create_index(op.f('ix_subscriptions_stripe_customer_id'), 'subscriptions', ['stripe_customer_id'], unique=False)
    op.create_index(op.f('ix_subscriptions_user_id'), 'subscriptions', ['user_id'], unique=False)
    op.create_table('plan_change_proposals',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('mesocycle_id', sa.UUID(), nullable=False),
    sa.Column('message_id', sa.UUID(), nullable=True),
    sa.Column('origin', sa.String(length=16), nullable=False),
    sa.Column('patch', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('diff', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('status', sa.String(length=12), nullable=False),
    sa.Column('invalid_reason_it', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['mesocycle_id'], ['mesocycles.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_plan_change_proposals_user_id'), 'plan_change_proposals', ['user_id'], unique=False)
    op.create_table('plan_weeks',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('mesocycle_id', sa.UUID(), nullable=False),
    sa.Column('n', sa.Integer(), nullable=False),
    sa.Column('is_deload', sa.Boolean(), nullable=False),
    sa.Column('is_maintenance', sa.Boolean(), nullable=False),
    sa.Column('label_it', sa.String(length=80), nullable=False),
    sa.Column('starts_on', sa.Date(), nullable=False),
    sa.Column('changes', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.ForeignKeyConstraint(['mesocycle_id'], ['mesocycles.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('mesocycle_id', 'n', name='uq_week_meso_n')
    )
    op.create_index(op.f('ix_plan_weeks_mesocycle_id'), 'plan_weeks', ['mesocycle_id'], unique=False)
    op.create_table('withdrawals',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('subscription_id', sa.UUID(), nullable=False),
    sa.Column('requested_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('refund_id', sa.String(length=64), nullable=True),
    sa.Column('amount_cents', sa.Integer(), nullable=False),
    sa.Column('currency', sa.String(length=3), nullable=False),
    sa.ForeignKeyConstraint(['subscription_id'], ['subscriptions.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_withdrawals_user_id'), 'withdrawals', ['user_id'], unique=False)
    op.create_table('planned_sessions',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('mesocycle_id', sa.UUID(), nullable=False),
    sa.Column('week_id', sa.UUID(), nullable=False),
    sa.Column('week_n', sa.Integer(), nullable=False),
    sa.Column('index_in_week', sa.Integer(), nullable=False),
    sa.Column('sessions_in_week', sa.Integer(), nullable=False),
    sa.Column('name', sa.String(length=80), nullable=False),
    sa.Column('template_key', sa.String(length=24), nullable=False),
    sa.Column('date', sa.Date(), nullable=False),
    sa.Column('status', sa.String(length=12), nullable=False),
    sa.Column('est_minutes', sa.Integer(), nullable=False),
    sa.Column('short_version', sa.Boolean(), nullable=False),
    sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('close_line', sa.Text(), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('missed_email_sent_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('no_day_message_id', sa.UUID(), nullable=True),
    sa.ForeignKeyConstraint(['mesocycle_id'], ['mesocycles.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['week_id'], ['plan_weeks.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_planned_sessions_date'), 'planned_sessions', ['date'], unique=False)
    op.create_index(op.f('ix_planned_sessions_mesocycle_id'), 'planned_sessions', ['mesocycle_id'], unique=False)
    op.create_index('ix_planned_sessions_user_date', 'planned_sessions', ['user_id', 'date'], unique=False)
    op.create_index(op.f('ix_planned_sessions_user_id'), 'planned_sessions', ['user_id'], unique=False)
    op.create_index(op.f('ix_planned_sessions_week_id'), 'planned_sessions', ['week_id'], unique=False)
    op.create_table('planned_exercises',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('session_id', sa.UUID(), nullable=False),
    sa.Column('exercise_id', sa.String(length=64), nullable=False),
    sa.Column('order', sa.Integer(), nullable=False),
    sa.Column('slot_pattern', sa.String(length=24), nullable=False),
    sa.Column('sets', sa.Integer(), nullable=False),
    sa.Column('reps_min', sa.Integer(), nullable=False),
    sa.Column('reps_max', sa.Integer(), nullable=False),
    sa.Column('rest_s', sa.Integer(), nullable=False),
    sa.Column('rir_target', sa.Integer(), nullable=False),
    sa.Column('rule_refs', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('substituted_from_id', sa.String(length=64), nullable=True),
    sa.Column('removed_today', sa.Boolean(), nullable=False),
    sa.Column('removed_reason_it', sa.String(length=200), nullable=True),
    sa.Column('removed_rule_id', sa.String(length=96), nullable=True),
    sa.Column('changed_today_label_it', sa.String(length=120), nullable=True),
    sa.Column('skipped', sa.Boolean(), nullable=False),
    sa.Column('original', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.ForeignKeyConstraint(['exercise_id'], ['exercises.id'], ),
    sa.ForeignKeyConstraint(['session_id'], ['planned_sessions.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['substituted_from_id'], ['exercises.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_planned_exercises_session_id'), 'planned_exercises', ['session_id'], unique=False)
    op.create_table('readiness_checks',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('session_id', sa.UUID(), nullable=False),
    sa.Column('sleep', sa.String(length=8), nullable=False),
    sa.Column('mood', sa.String(length=8), nullable=False),
    sa.Column('pain', sa.String(length=8), nullable=False),
    sa.Column('short_version', sa.Boolean(), nullable=False),
    sa.Column('override', sa.Boolean(), nullable=False),
    sa.Column('diff', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['session_id'], ['planned_sessions.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('session_id')
    )
    op.create_index(op.f('ix_readiness_checks_user_id'), 'readiness_checks', ['user_id'], unique=False)
    op.create_table('session_ops',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('session_id', sa.UUID(), nullable=False),
    sa.Column('client_op_id', sa.String(length=64), nullable=False),
    sa.Column('op', sa.String(length=24), nullable=False),
    sa.Column('result', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['session_id'], ['planned_sessions.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('session_id', 'client_op_id', name='uq_session_op')
    )
    op.create_index(op.f('ix_session_ops_session_id'), 'session_ops', ['session_id'], unique=False)
    op.create_table('session_sets',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('planned_exercise_id', sa.UUID(), nullable=False),
    sa.Column('session_id', sa.UUID(), nullable=False),
    sa.Column('n', sa.Integer(), nullable=False),
    sa.Column('target_weight_kg', sa.Numeric(precision=6, scale=2), nullable=True),
    sa.Column('target_reps', sa.Integer(), nullable=False),
    sa.Column('target_rir', sa.Integer(), nullable=False),
    sa.Column('logged_weight_kg', sa.Numeric(precision=6, scale=2), nullable=True),
    sa.Column('logged_reps', sa.Integer(), nullable=True),
    sa.Column('logged_rir', sa.Integer(), nullable=True),
    sa.Column('status', sa.String(length=8), nullable=False),
    sa.Column('done_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('client_updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['planned_exercise_id'], ['planned_exercises.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['session_id'], ['planned_sessions.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_session_sets_planned_exercise_id'), 'session_sets', ['planned_exercise_id'], unique=False)
    op.create_index(op.f('ix_session_sets_session_id'), 'session_sets', ['session_id'], unique=False)
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index(op.f('ix_session_sets_session_id'), table_name='session_sets')
    op.drop_index(op.f('ix_session_sets_planned_exercise_id'), table_name='session_sets')
    op.drop_table('session_sets')
    op.drop_index(op.f('ix_session_ops_session_id'), table_name='session_ops')
    op.drop_table('session_ops')
    op.drop_index(op.f('ix_readiness_checks_user_id'), table_name='readiness_checks')
    op.drop_table('readiness_checks')
    op.drop_index(op.f('ix_planned_exercises_session_id'), table_name='planned_exercises')
    op.drop_table('planned_exercises')
    op.drop_index(op.f('ix_planned_sessions_week_id'), table_name='planned_sessions')
    op.drop_index(op.f('ix_planned_sessions_user_id'), table_name='planned_sessions')
    op.drop_index('ix_planned_sessions_user_date', table_name='planned_sessions')
    op.drop_index(op.f('ix_planned_sessions_mesocycle_id'), table_name='planned_sessions')
    op.drop_index(op.f('ix_planned_sessions_date'), table_name='planned_sessions')
    op.drop_table('planned_sessions')
    op.drop_index(op.f('ix_withdrawals_user_id'), table_name='withdrawals')
    op.drop_table('withdrawals')
    op.drop_index(op.f('ix_plan_weeks_mesocycle_id'), table_name='plan_weeks')
    op.drop_table('plan_weeks')
    op.drop_index(op.f('ix_plan_change_proposals_user_id'), table_name='plan_change_proposals')
    op.drop_table('plan_change_proposals')
    op.drop_index(op.f('ix_subscriptions_user_id'), table_name='subscriptions')
    op.drop_index(op.f('ix_subscriptions_stripe_customer_id'), table_name='subscriptions')
    op.drop_table('subscriptions')
    op.drop_index(op.f('ix_refresh_tokens_user_id'), table_name='refresh_tokens')
    op.drop_table('refresh_tokens')
    op.drop_table('profiles')
    op.drop_index(op.f('ix_one_time_tokens_user_id'), table_name='one_time_tokens')
    op.drop_table('one_time_tokens')
    op.drop_index(op.f('ix_mesocycles_user_id'), table_name='mesocycles')
    op.drop_table('mesocycles')
    op.drop_index(op.f('ix_llm_usage_user_id'), table_name='llm_usage')
    op.drop_table('llm_usage')
    op.drop_index(op.f('ix_events_user_id'), table_name='events')
    op.drop_index(op.f('ix_events_name'), table_name='events')
    op.drop_table('events')
    op.drop_table('entitlements')
    op.drop_index(op.f('ix_email_log_user_id'), table_name='email_log')
    op.drop_table('email_log')
    op.drop_index(op.f('ix_data_exports_user_id'), table_name='data_exports')
    op.drop_table('data_exports')
    op.drop_index(op.f('ix_chat_messages_user_id'), table_name='chat_messages')
    op.drop_index('ix_chat_messages_user_created', table_name='chat_messages')
    op.drop_table('chat_messages')
    op.drop_table('users')
    op.drop_table('stripe_events')
    op.drop_table('rules')
    op.drop_table('exercises')
    op.execute("DROP INDEX IF EXISTS ix_corpus_chunks_fts")
    op.execute("DROP INDEX IF EXISTS ix_corpus_chunks_embedding_hnsw")
    op.drop_index(op.f('ix_corpus_chunks_doc_id'), table_name='corpus_chunks')
    op.drop_table('corpus_chunks')
    op.drop_table('citations')
    # ### end Alembic commands ###
