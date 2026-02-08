import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProcessSourcing } from '../api/sourcing';
import type { ProcessingFilters } from '../types/api';

interface ExecutionViewProps {
  keywords?: string[];
  rssFeedUrls?: string[];
  filters?: ProcessingFilters;
}

/**
 * ExecutionView component - Initiates candidate sourcing workflow
 */
export function ExecutionView({
  keywords = [],
  rssFeedUrls = [],
  filters = { minimumConfidence: 70, signalTypes: ['HIRING', 'COMPANY', 'INDIVIDUAL'] }
}: ExecutionViewProps) {
  const navigate = useNavigate();
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const { mutate, isPending, isSuccess } = useProcessSourcing({
    onSuccess: (data) => {
      // Navigate to IntelligenceView with results
      navigate('/intelligence', { state: { results: data.results } });
    },
    onError: (error) => {
      // Display error toast
      const message = error instanceof Error ? error.message : 'An unexpected error occurred';
      setToast({ message, type: 'error' });

      // Auto-dismiss after 5 seconds
      setTimeout(() => setToast(null), 5000);
    }
  });

  const handleExecute = () => {
    mutate({
      keywords,
      rssFeedUrls,
      filters
    });
  };

  return (
    <div className="execution-view">
      <h2>Execute Candidate Sourcing</h2>

      <div className="config-summary">
        <p><strong>Keywords:</strong> {keywords.length > 0 ? keywords.join(', ') : 'None'}</p>
        <p><strong>RSS Feeds:</strong> {rssFeedUrls.length > 0 ? rssFeedUrls.length : 'None'}</p>
        <p><strong>Minimum Confidence:</strong> {filters.minimumConfidence}%</p>
        <p><strong>Signal Types:</strong> {filters.signalTypes.join(', ')}</p>
      </div>

      <button
        onClick={handleExecute}
        disabled={isPending}
        className="execute-button"
        data-testid="execute-button"
      >
        {isPending ? (
          <span className="loading-spinner">
            ⏳ Processing...
          </span>
        ) : (
          'Execute Search'
        )}
      </button>

      {/* Toast notification */}
      {toast && (
        <div
          className={`toast toast-${toast.type}`}
          data-testid="error-toast"
          role="alert"
        >
          {toast.message}
        </div>
      )}

      {/* Success indicator (before navigation) */}
      {isSuccess && (
        <div className="success-message" data-testid="success-message">
          ✅ Processing complete! Redirecting...
        </div>
      )}
    </div>
  );
}
