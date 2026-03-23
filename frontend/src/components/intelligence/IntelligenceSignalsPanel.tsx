// @crumb frontend-component-intelligence-signals-panel
// UI/Intelligence | fetch_signals | grouped_display | add_signal | edit_delete | timeline_event_creation
// why: Display and manage intelligence signals for an account or prospect — the core "research layer" that builds account picture
// in:accountId,orgId,level,contactId(optional),supabase intelligence_signals+timeline_events tables out:Grouped signal cards with CRUD,timeline events on mutations err:Supabase query failure (logged),missing auth (early return)
// hazard: Signals fetched without pagination — high-volume accounts could slow render
// hazard: Timeline event insert failure after signal insert leaves orphan signal without audit trail
// edge:frontend/src/lib/supabase.ts -> CALLS
// edge:frontend/src/hooks/useAuth.ts -> CALLS
// edge:frontend/src/lib/error-logger.ts -> CALLS
// prompt: Add pagination for accounts with 50+ signals. Consider optimistic UI for add/delete. Batch signal+timeline inserts in a transaction via RPC.

import { useEffect, useState, useCallback } from 'react';
import { Star, Plus, Pencil, Trash2, X, Check, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { logError } from '../../lib/error-logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IntelligenceSignalsPanelProps {
  accountId: string;
  orgId: string;
  level?: 'account' | 'prospect';
  contactId?: string;
}

interface Signal {
  id: string;
  org_id: string;
  account_id: string;
  contact_id: string | null;
  level: 'account' | 'prospect';
  signal_type: string;
  content: string;
  classification: string | null;
  confidence: number;
  evidence_reference: string | null;
  source: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface SignalFormData {
  signal_type: string;
  content: string;
  confidence: number;
  evidence_reference: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCOUNT_SIGNAL_TYPES = [
  { value: 'business_context', label: 'Business Context' },
  { value: 'problem_fit', label: 'Problem Fit' },
  { value: 'pain_evidence', label: 'Pain Evidence' },
  { value: 'economic_impact', label: 'Economic Impact' },
  { value: 'buying_readiness', label: 'Buying Readiness' },
  { value: 'stakeholder_coverage', label: 'Stakeholder Coverage' },
] as const;

const PROSPECT_SIGNAL_TYPES = [
  { value: 'role_relevance', label: 'Role Relevance' },
  { value: 'influence_level', label: 'Influence Level' },
  { value: 'problem_awareness', label: 'Problem Awareness' },
  { value: 'relationship_strength', label: 'Relationship Strength' },
  { value: 'engagement', label: 'Engagement' },
] as const;

const SOURCE_BADGE_STYLES: Record<string, string> = {
  manual: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  activity_derived: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  ai_suggested: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
};

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Manual',
  activity_derived: 'Activity Derived',
  ai_suggested: 'AI Suggested',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSignalTypes(level: 'account' | 'prospect') {
  return level === 'prospect' ? PROSPECT_SIGNAL_TYPES : ACCOUNT_SIGNAL_TYPES;
}

function getSignalTypeLabel(signalType: string, level: 'account' | 'prospect'): string {
  const types = getSignalTypes(level);
  const found = types.find((t) => t.value === signalType);
  return found ? found.label : signalType;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  }).format(date);
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '...' : text;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ConfidenceStars({
  value,
  onChange,
  readonly = false,
}: {
  value: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readonly}
          onClick={() => onChange?.(n)}
          className={readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110 transition-transform'}
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
        >
          <Star
            className={`w-4 h-4 ${n <= value ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}
          />
        </button>
      ))}
    </span>
  );
}

function SourceBadge({ source }: { source: string }) {
  const style = SOURCE_BADGE_STYLES[source] || SOURCE_BADGE_STYLES['manual'];
  const label = SOURCE_LABELS[source] || source;

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Signal Card
// ---------------------------------------------------------------------------

function SignalCard({
  signal,
  level,
  currentUserId,
  onDelete,
  onUpdate,
}: {
  signal: Signal;
  level: 'account' | 'prospect';
  currentUserId: string | undefined;
  onDelete: (id: string) => void;
  onUpdate: (id: string, data: Partial<SignalFormData>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(signal.content);
  const [editConfidence, setEditConfidence] = useState(signal.confidence);
  const [editEvidence, setEditEvidence] = useState(signal.evidence_reference || '');
  const isOwner = currentUserId === signal.created_by;

  const handleSaveEdit = () => {
    onUpdate(signal.id, {
      content: editContent,
      confidence: editConfidence,
      evidence_reference: editEvidence,
    });
    setEditing(false);
  };

  const handleCancelEdit = () => {
    setEditContent(signal.content);
    setEditConfidence(signal.confidence);
    setEditEvidence(signal.evidence_reference || '');
    setEditing(false);
  };

  return (
    <div className="p-4 bg-white dark:bg-void-800/50 rounded-lg border border-gray-200 dark:border-white/10">
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-gray-900 dark:text-white text-sm">
          {getSignalTypeLabel(signal.signal_type, level)}
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {formatRelativeTime(signal.created_at)}
          </span>
          {isOwner && !editing && (
            <>
              <button
                onClick={() => setEditing(true)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                aria-label="Edit signal"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDelete(signal.id)}
                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                aria-label="Delete signal"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <div className="mt-2 space-y-2">
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
            rows={3}
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">Confidence:</span>
            <ConfidenceStars value={editConfidence} onChange={setEditConfidence} />
          </div>
          <input
            type="text"
            value={editEvidence}
            onChange={(e) => setEditEvidence(e.target.value)}
            placeholder="Evidence reference (optional)"
            className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSaveEdit}
              disabled={!editContent.trim()}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" /> Save
            </button>
            <button
              onClick={handleCancelEdit}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{signal.content}</p>
          <div className="mt-2 flex items-center gap-3 flex-wrap">
            <ConfidenceStars value={signal.confidence} readonly />
            <SourceBadge source={signal.source} />
            {signal.evidence_reference && (
              <span className="text-xs text-gray-400 dark:text-gray-500 italic">
                {truncate(signal.evidence_reference, 60)}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Signal Form
// ---------------------------------------------------------------------------

function AddSignalForm({
  level,
  saving,
  onSave,
  onCancel,
}: {
  level: 'account' | 'prospect';
  saving: boolean;
  onSave: (data: SignalFormData) => void;
  onCancel: () => void;
}) {
  const types = getSignalTypes(level);
  const [signalType, setSignalType] = useState<string>(types[0].value);
  const [content, setContent] = useState('');
  const [confidence, setConfidence] = useState(3);
  const [evidenceReference, setEvidenceReference] = useState('');

  const handleSubmit = () => {
    if (!content.trim()) return;
    onSave({
      signal_type: signalType,
      content: content.trim(),
      confidence,
      evidence_reference: evidenceReference.trim(),
    });
  };

  return (
    <div className="p-4 bg-blue-50 dark:bg-indigo-electric/10 rounded-lg border border-blue-200 dark:border-indigo-electric/20 space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          Signal Type
        </label>
        <select
          value={signalType}
          onChange={(e) => setSignalType(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        >
          {types.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          Content <span className="text-red-500">*</span>
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Describe the intelligence signal..."
          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
          rows={3}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          Confidence
        </label>
        <ConfidenceStars value={confidence} onChange={setConfidence} />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          Evidence Reference (optional)
        </label>
        <input
          type="text"
          value={evidenceReference}
          onChange={(e) => setEvidenceReference(e.target.value)}
          placeholder="URL, document name, or source reference"
          className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={!content.trim() || saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save Signal
        </button>
        <button
          onClick={onCancel}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function IntelligenceSignalsPanel({
  accountId,
  orgId,
  level = 'account',
  contactId,
}: IntelligenceSignalsPanelProps) {
  const { user } = useAuth();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadSignals = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('intelligence_signals')
        .select('*')
        .eq('account_id', accountId)
        .eq('org_id', orgId)
        .eq('level', level)
        .order('created_at', { ascending: false });

      if (level === 'prospect' && contactId) {
        query = query.eq('contact_id', contactId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setSignals(data || []);
    } catch (err) {
      logError(err, 'IntelligenceSignalsPanel.loadSignals');
    } finally {
      setLoading(false);
    }
  }, [accountId, orgId, level, contactId]);

  useEffect(() => {
    loadSignals();
  }, [loadSignals]);

  const handleAddSignal = async (formData: SignalFormData) => {
    if (!user) return;
    setSaving(true);
    try {
      const insertPayload: Record<string, unknown> = {
        org_id: orgId,
        account_id: accountId,
        level,
        signal_type: formData.signal_type,
        content: formData.content,
        confidence: formData.confidence,
        evidence_reference: formData.evidence_reference || null,
        source: 'manual',
        created_by: user.id,
      };

      if (level === 'prospect' && contactId) {
        insertPayload.contact_id = contactId;
      }

      const { data: newSignal, error } = await supabase
        .from('intelligence_signals')
        .insert(insertPayload)
        .select('id')
        .single();

      if (error) throw error;

      const typeLabel = getSignalTypeLabel(formData.signal_type, level);

      // Create timeline event for audit trail
      const timelinePayload: Record<string, unknown> = {
        org_id: orgId,
        account_id: accountId,
        event_type: 'signal_created',
        linked_signal_id: newSignal.id,
        title: `Added ${typeLabel} signal`,
        body: truncate(formData.content, 120),
        actor_type: 'user',
        actor_id: user.id,
      };

      if (contactId) {
        timelinePayload.contact_id = contactId;
      }

      await supabase.from('timeline_events').insert(timelinePayload);

      setShowAddForm(false);
      await loadSignals();
    } catch (err) {
      logError(err, 'IntelligenceSignalsPanel.handleAddSignal');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSignal = async (signalId: string) => {
    if (!user) return;

    const signal = signals.find((s) => s.id === signalId);
    if (!signal) return;

    try {
      const { error } = await supabase
        .from('intelligence_signals')
        .delete()
        .eq('id', signalId);

      if (error) throw error;

      const typeLabel = getSignalTypeLabel(signal.signal_type, level);

      const timelinePayload: Record<string, unknown> = {
        org_id: orgId,
        account_id: accountId,
        event_type: 'signal_deleted',
        title: `Removed ${typeLabel} signal`,
        body: truncate(signal.content, 120),
        actor_type: 'user',
        actor_id: user.id,
      };

      if (contactId) {
        timelinePayload.contact_id = contactId;
      }

      await supabase.from('timeline_events').insert(timelinePayload);

      await loadSignals();
    } catch (err) {
      logError(err, 'IntelligenceSignalsPanel.handleDeleteSignal');
    }
  };

  const handleUpdateSignal = async (signalId: string, data: Partial<SignalFormData>) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('intelligence_signals')
        .update({
          content: data.content,
          confidence: data.confidence,
          evidence_reference: data.evidence_reference || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', signalId);

      if (error) throw error;
      await loadSignals();
    } catch (err) {
      logError(err, 'IntelligenceSignalsPanel.handleUpdateSignal');
    }
  };

  // Group signals by signal_type for display
  const signalTypes = getSignalTypes(level);
  const groupedSignals = signalTypes.reduce<Record<string, Signal[]>>((acc, type) => {
    const matching = signals.filter((s) => s.signal_type === type.value);
    if (matching.length > 0) {
      acc[type.value] = matching;
    }
    return acc;
  }, {});

  // Include any signals with types not in our known list
  const knownTypes = new Set<string>(signalTypes.map((t) => t.value));
  const unknownSignals = signals.filter((s) => !knownTypes.has(s.signal_type));
  if (unknownSignals.length > 0) {
    groupedSignals['_other'] = unknownSignals;
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading intelligence signals...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Add button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Intelligence Signals
        </h3>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Signal
          </button>
        )}
      </div>

      {/* Add Signal Form */}
      {showAddForm && (
        <AddSignalForm
          level={level}
          saving={saving}
          onSave={handleAddSignal}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* Signals grouped by type */}
      {Object.keys(groupedSignals).length === 0 ? (
        <div className="text-center py-8">
          <Star className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No intelligence signals yet — add your first signal to start building the account picture
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedSignals).map(([typeKey, typeSignals]) => (
            <div key={typeKey} className="space-y-2">
              <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {typeKey === '_other'
                  ? 'Other'
                  : getSignalTypeLabel(typeKey, level)}
                <span className="ml-1.5 text-gray-400 dark:text-gray-500">
                  ({typeSignals.length})
                </span>
              </h4>
              {typeSignals.map((signal) => (
                <SignalCard
                  key={signal.id}
                  signal={signal}
                  level={level}
                  currentUserId={user?.id}
                  onDelete={handleDeleteSignal}
                  onUpdate={handleUpdateSignal}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
