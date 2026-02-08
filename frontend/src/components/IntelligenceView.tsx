import { useLocation } from 'react-router-dom';
import { useState, useMemo } from 'react';
import type { ProcessResponse, Candidate, SignalType } from '../types/api';

/**
 * IntelligenceView component - Displays sourcing results in sortable table
 * US-006: Table with Name, Confidence, Signal Type, Source, Actions
 */
export function IntelligenceView() {
  const location = useLocation();
  const results = location.state?.results as ProcessResponse['results'] | undefined;
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Sort candidates by confidence (default: descending)
  const sortedCandidates = useMemo(() => {
    if (!results?.candidates) return [];

    return [...results.candidates].sort((a, b) => {
      return sortDirection === 'desc'
        ? b.confidenceScore - a.confidenceScore
        : a.confidenceScore - b.confidenceScore;
    });
  }, [results?.candidates, sortDirection]);

  const toggleSort = () => {
    setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
  };

  // Get signal type color
  const getSignalColor = (type: SignalType): string => {
    switch (type) {
      case 'HIRING': return '#22c55e'; // green
      case 'COMPANY': return '#3b82f6'; // blue
      case 'INDIVIDUAL': return '#a855f7'; // purple
      default: return '#6b7280'; // gray fallback
    }
  };

  // Get primary signal type for a candidate
  const getPrimarySignalType = (candidate: Candidate): SignalType | null => {
    if (candidate.signals.length === 0) return null;
    // Return first signal type (highest confidence signal should be first)
    return candidate.signals[0].type;
  };

  // Empty state
  if (!results || sortedCandidates.length === 0) {
    return (
      <div className="intelligence-view">
        <h2>Intelligence Results</h2>
        <div className="empty-state">
          <p>No candidates found. Please execute a search to see results.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="intelligence-view">
      <div className="results-header">
        <h2>Intelligence Results</h2>
        <p className="results-summary">
          Found {sortedCandidates.length} qualified candidates
          ({results.metadata.totalProcessed} total processed)
        </p>
      </div>

      <div className="table-container">
        <table className="results-table">
          <thead>
            <tr>
              <th>Name</th>
              <th onClick={toggleSort} className="sortable">
                Confidence (%)
                <span className="sort-indicator">
                  {sortDirection === 'desc' ? '↓' : '↑'}
                </span>
              </th>
              <th>Signal Type</th>
              <th>Source</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedCandidates.map((candidate) => {
              const primarySignal = getPrimarySignalType(candidate);
              const signalColor = primarySignal ? getSignalColor(primarySignal) : '#6b7280';

              return (
                <tr key={candidate.id}>
                  <td className="candidate-name">{candidate.name}</td>

                  <td className="confidence-cell">
                    <div className="confidence-display">
                      <span className="confidence-value">
                        {candidate.confidenceScore}%
                      </span>
                      <div className="confidence-bar-container">
                        <div
                          className="confidence-bar"
                          style={{
                            width: `${candidate.confidenceScore}%`,
                            backgroundColor: signalColor
                          }}
                        />
                      </div>
                    </div>
                  </td>

                  <td className="signal-type">
                    {primarySignal ? (
                      <span
                        className="signal-badge"
                        style={{
                          backgroundColor: signalColor,
                          color: 'white'
                        }}
                      >
                        {primarySignal}
                      </span>
                    ) : (
                      <span className="signal-badge-empty">—</span>
                    )}
                  </td>

                  <td className="source">{candidate.source}</td>

                  <td className="actions">
                    <button
                      className="action-button"
                      onClick={() => console.log('View details:', candidate)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
