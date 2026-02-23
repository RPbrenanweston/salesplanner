import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface CustomKPIModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type FormulaType = 'count' | 'ratio' | 'sum';
type Period = 'daily' | 'weekly' | 'monthly';

const metricOptions = [
  { value: 'calls', label: 'Calls' },
  { value: 'emails', label: 'Emails' },
  { value: 'social_touches', label: 'Social Touches' },
  { value: 'meetings_booked', label: 'Meetings Booked' },
  { value: 'connects', label: 'Connects' },
  { value: 'replies', label: 'Email Replies' },
  { value: 'pipeline_value', label: 'Pipeline Value' },
];

export default function CustomKPIModal({ isOpen, onClose, onSuccess }: CustomKPIModalProps) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [formulaType, setFormulaType] = useState<FormulaType>('count');
  const [numeratorMetric, setNumeratorMetric] = useState('calls');
  const [denominatorMetric, setDenominatorMetric] = useState('');
  const [period, setPeriod] = useState<Period>('daily');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

  const resetForm = () => {
    setName('');
    setFormulaType('count');
    setNumeratorMetric('calls');
    setDenominatorMetric('');
    setPeriod('daily');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validate ratio has denominator
    if (formulaType === 'ratio' && !denominatorMetric) {
      alert('Ratio KPIs require both a numerator and denominator metric.');
      return;
    }

    setLoading(true);
    try {
      // Get user's org_id
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user.id)
        .single();

      if (userError) throw userError;

      // Create custom KPI
      const { error } = await supabase.from('custom_kpis').insert({
        org_id: userData.org_id,
        user_id: user.id,
        name,
        formula_type: formulaType,
        numerator_metric: numeratorMetric,
        denominator_metric: formulaType === 'ratio' ? denominatorMetric : null,
        period,
      });

      if (error) throw error;

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error creating custom KPI:', err);
      alert('Failed to create custom KPI. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Add Custom KPI</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              KPI Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Daily Connect Rate"
              required
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>

          {/* Formula Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Formula Type
            </label>
            <select
              value={formulaType}
              onChange={(e) => setFormulaType(e.target.value as FormulaType)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="count">Count (total number of activities)</option>
              <option value="ratio">Ratio (numerator / denominator * 100)</option>
              <option value="sum">Sum (total value)</option>
            </select>
          </div>

          {/* Numerator Metric */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {formulaType === 'ratio' ? 'Numerator Metric' : 'Metric'}
            </label>
            <select
              value={numeratorMetric}
              onChange={(e) => setNumeratorMetric(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              {metricOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Denominator Metric (only for ratio) */}
          {formulaType === 'ratio' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Denominator Metric
              </label>
              <select
                value={denominatorMetric}
                onChange={(e) => setDenominatorMetric(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">Select denominator...</option>
                {metricOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Period */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Period
            </label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          {/* Example */}
          <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Example:</strong> {getExampleText()}
            </p>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Add KPI'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  function getExampleText(): string {
    if (formulaType === 'count') {
      return `Counts total ${metricOptions.find((m) => m.value === numeratorMetric)?.label} per ${period}.`;
    } else if (formulaType === 'ratio') {
      const numLabel = metricOptions.find((m) => m.value === numeratorMetric)?.label;
      const denLabel = denominatorMetric
        ? metricOptions.find((m) => m.value === denominatorMetric)?.label
        : '[select denominator]';
      return `Calculates (${numLabel} / ${denLabel}) * 100 per ${period}.`;
    } else {
      return `Sums total value of ${metricOptions.find((m) => m.value === numeratorMetric)?.label} per ${period}.`;
    }
  }
}
