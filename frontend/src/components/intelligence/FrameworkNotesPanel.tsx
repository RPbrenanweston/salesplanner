// @crumb frontend-component-framework-notes-panel
// UI/Intelligence | framework_selector | dimension_notes | auto_save | timeline_event_creation
// why: Structured SPIN/BANT/MEDDIC framework notes per account — guides reps through qualification dimensions with auto-saving textareas
// in:accountId,orgId,defaultFramework(optional) out:Framework selector UI,expandable dimension cards with auto-saving textareas,timeline events on save err:Supabase query failure (logged),missing auth (early return)
// hazard: Each dimension blur triggers an upsert + timeline insert — rapid tab-through could create many timeline events
// hazard: No optimistic UI — save indicator depends on round-trip completion
// edge:frontend/src/lib/supabase.ts -> CALLS
// edge:frontend/src/hooks/useAuth.ts -> CALLS
// edge:frontend/src/lib/error-logger.ts -> CALLS

import { useEffect, useState, useCallback, useRef } from 'react';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { logError } from '../../lib/error-logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FrameworkNotesPanelProps {
  accountId: string;
  orgId: string;
  defaultFramework?: string | null;
}

interface Dimension {
  key: string;
  label: string;
  description: string;
}

interface FrameworkDef {
  label: string;
  dimensions: Dimension[];
}

interface DimensionSignal {
  id: string;
  signal_type: string;
  content: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type FrameworkKey = 'bant' | 'spin' | 'meddic';

const FRAMEWORKS: Record<FrameworkKey, FrameworkDef> = {
  bant: {
    label: 'BANT',
    dimensions: [
      { key: 'fw_bant_budget', label: 'Budget', description: 'What budget is available? Who controls it?' },
      { key: 'fw_bant_authority', label: 'Authority', description: 'Who makes the buying decision?' },
      { key: 'fw_bant_need', label: 'Need', description: 'What business problem are they solving?' },
      { key: 'fw_bant_timeline', label: 'Timeline', description: 'When do they need a solution?' },
    ],
  },
  spin: {
    label: 'SPIN',
    dimensions: [
      { key: 'fw_spin_situation', label: 'Situation', description: "Current state of the prospect's business" },
      { key: 'fw_spin_problem', label: 'Problem', description: 'Difficulties and dissatisfactions' },
      { key: 'fw_spin_implication', label: 'Implication', description: 'Consequences of the problem' },
      { key: 'fw_spin_need_payoff', label: 'Need-Payoff', description: 'Value of solving the problem' },
    ],
  },
  meddic: {
    label: 'MEDDIC',
    dimensions: [
      { key: 'fw_meddic_metrics', label: 'Metrics', description: 'Quantifiable measures of success' },
      { key: 'fw_meddic_economic_buyer', label: 'Economic Buyer', description: 'Person with budget authority' },
      { key: 'fw_meddic_decision_criteria', label: 'Decision Criteria', description: "How they'll evaluate options" },
      { key: 'fw_meddic_decision_process', label: 'Decision Process', description: 'Steps to make a purchase decision' },
      { key: 'fw_meddic_identify_pain', label: 'Identify Pain', description: 'The core business pain point' },
      { key: 'fw_meddic_champion', label: 'Champion', description: 'Internal advocate for your solution' },
    ],
  },
};

const FRAMEWORK_DESCRIPTIONS: Record<FrameworkKey, string> = {
  bant: 'Budget, Authority, Need, Timeline',
  spin: 'Situation, Problem, Implication, Need-Payoff',
  meddic: 'Metrics, Economic Buyer, Decision Criteria & Process, Pain, Champion',
};

function isFrameworkKey(value: string): value is FrameworkKey {
  return value === 'bant' || value === 'spin' || value === 'meddic';
}

// ---------------------------------------------------------------------------
// Saved Indicator
// ---------------------------------------------------------------------------

function SavedIndicator({ visible }: { visible: boolean }) {
  return (
    <span
      className={`text-xs text-emerald-500 font-medium transition-opacity duration-500 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      Saved
    </span>
  );
}

// ---------------------------------------------------------------------------
// Dimension Card
// ---------------------------------------------------------------------------

function DimensionCard({
  dimension,
  value,
  signalId,
  accountId,
  orgId,
  userId,
}: {
  dimension: Dimension;
  value: string;
  signalId: string | null;
  accountId: string;
  orgId: string;
  userId: string;
}) {
  const [expanded, setExpanded] = useState(value.length > 0);
  const [content, setContent] = useState(value);
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track the current signalId locally so upserts that create a new row
  // can be followed by updates without re-fetching
  const currentSignalId = useRef<string | null>(signalId);

  // Sync from parent when signals reload
  useEffect(() => {
    setContent(value);
  }, [value]);

  useEffect(() => {
    currentSignalId.current = signalId;
  }, [signalId]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const handleBlur = async () => {
    const trimmed = content.trim();

    // Nothing to save if content unchanged
    if (trimmed === value) return;

    // If content cleared and no existing signal, nothing to do
    if (!trimmed && !currentSignalId.current) return;

    setSaving(true);
    try {
      if (currentSignalId.current) {
        // Update existing signal
        const { error } = await supabase
          .from('intelligence_signals')
          .update({
            content: trimmed,
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentSignalId.current);

        if (error) throw error;
      } else if (trimmed) {
        // Insert new signal
        const { data: newSignal, error } = await supabase
          .from('intelligence_signals')
          .insert({
            org_id: orgId,
            account_id: accountId,
            level: 'account',
            signal_type: dimension.key,
            content: trimmed,
            confidence: 3,
            source: 'manual',
            created_by: userId,
          })
          .select('id')
          .single();

        if (error) throw error;
        currentSignalId.current = newSignal.id;
      }

      // Create timeline event for the save
      await supabase.from('timeline_events').insert({
        org_id: orgId,
        account_id: accountId,
        event_type: 'framework_review',
        title: `Updated ${dimension.label} (${dimension.key.split('_')[1]?.toUpperCase() ?? ''})`,
        body: trimmed.length > 120 ? trimmed.slice(0, 120) + '...' : trimmed,
        actor_type: 'user',
        actor_id: userId,
      });

      // Show saved indicator
      setShowSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setShowSaved(false), 2000);
    } catch (err) {
      logError(err, `FrameworkNotesPanel.saveDimension.${dimension.key}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-3 p-4 bg-white dark:bg-void-800/50 rounded-lg border border-gray-200 dark:border-white/10">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex items-center gap-2 w-full text-left"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
        )}
        <span className="font-semibold text-sm text-gray-900 dark:text-white">
          {dimension.label}
        </span>
        <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
          {dimension.description}
        </span>
        <span className="ml-auto flex items-center gap-2">
          {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
          <SavedIndicator visible={showSaved} />
        </span>
      </button>

      {expanded && (
        <div className="mt-3">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onBlur={handleBlur}
            placeholder={`Notes on ${dimension.label.toLowerCase()}...`}
            className="w-full min-h-[80px] p-3 bg-gray-50 dark:bg-void-900 border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 resize-y focus:outline-none focus:ring-2 focus:ring-indigo-electric/50 focus:border-indigo-electric"
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Framework Selector
// ---------------------------------------------------------------------------

function FrameworkSelector({
  selected,
  onSelect,
}: {
  selected: FrameworkKey | null;
  onSelect: (key: FrameworkKey) => void;
}) {
  const keys: FrameworkKey[] = ['bant', 'spin', 'meddic'];

  return (
    <div className="grid grid-cols-3 gap-3">
      {keys.map((key) => {
        const fw = FRAMEWORKS[key];
        const isSelected = selected === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            className={`p-4 rounded-lg text-left transition-colors ${
              isSelected
                ? 'border-2 border-indigo-electric bg-indigo-electric/5'
                : 'border border-gray-200 dark:border-white/10 hover:border-indigo-electric/50'
            }`}
          >
            <span className="block font-semibold text-sm text-gray-900 dark:text-white">
              {fw.label}
            </span>
            <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
              {FRAMEWORK_DESCRIPTIONS[key]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function FrameworkNotesPanel({
  accountId,
  orgId,
  defaultFramework,
}: FrameworkNotesPanelProps) {
  const { user } = useAuth();
  const [selectedFramework, setSelectedFramework] = useState<FrameworkKey | null>(
    defaultFramework && isFrameworkKey(defaultFramework) ? defaultFramework : null,
  );
  const [signals, setSignals] = useState<DimensionSignal[]>([]);
  const [loading, setLoading] = useState(false);

  const loadDimensionSignals = useCallback(async () => {
    if (!selectedFramework) return;

    setLoading(true);
    try {
      const framework = FRAMEWORKS[selectedFramework];
      const dimensionKeys = framework.dimensions.map((d) => d.key);

      const { data, error } = await supabase
        .from('intelligence_signals')
        .select('id, signal_type, content')
        .eq('account_id', accountId)
        .eq('org_id', orgId)
        .eq('level', 'account')
        .in('signal_type', dimensionKeys);

      if (error) throw error;
      setSignals((data as DimensionSignal[]) || []);
    } catch (err) {
      logError(err, 'FrameworkNotesPanel.loadDimensionSignals');
    } finally {
      setLoading(false);
    }
  }, [accountId, orgId, selectedFramework]);

  useEffect(() => {
    loadDimensionSignals();
  }, [loadDimensionSignals]);

  const handleSelectFramework = (key: FrameworkKey) => {
    setSelectedFramework(key);
  };

  if (!user) return null;

  const framework = selectedFramework ? FRAMEWORKS[selectedFramework] : null;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
        Qualification Framework
      </h3>

      <FrameworkSelector selected={selectedFramework} onSelect={handleSelectFramework} />

      {loading && (
        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm py-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading framework notes...
        </div>
      )}

      {framework && !loading && (
        <div>
          {framework.dimensions.map((dim) => {
            const existing = signals.find((s) => s.signal_type === dim.key);
            return (
              <DimensionCard
                key={dim.key}
                dimension={dim}
                value={existing?.content ?? ''}
                signalId={existing?.id ?? null}
                accountId={accountId}
                orgId={orgId}
                userId={user.id}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
