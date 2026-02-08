import { useLocation } from 'react-router-dom';
import type { ProcessResponse } from '../types/api';

/**
 * IntelligenceView component - Displays sourcing results
 * Full implementation in US-006
 */
export function IntelligenceView() {
  const location = useLocation();
  const results = location.state?.results as ProcessResponse['results'] | undefined;

  return (
    <div className="intelligence-view">
      <h2>Intelligence Results</h2>

      {results ? (
        <div>
          <p>Received {results.candidates.length} candidates</p>
          <p>Implementation pending (US-006)</p>
          <pre>{JSON.stringify(results, null, 2)}</pre>
        </div>
      ) : (
        <p>No results available. Please execute a search first.</p>
      )}
    </div>
  );
}
