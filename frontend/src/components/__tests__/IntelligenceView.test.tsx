import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { IntelligenceView } from '../IntelligenceView';
import type { ProcessResponse } from '../../types/api';

// Mock useLocation
const mockLocation = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useLocation: () => mockLocation(),
  };
});

const mockResults: ProcessResponse['results'] = {
  candidates: [
    {
      id: '1',
      name: 'Jane Doe',
      source: 'GitHub',
      confidenceScore: 95,
      signals: [
        {
          type: 'HIRING',
          text: 'We are hiring engineers',
          confidence: 0.95,
          patterns: ['hiring'],
          keywords: ['hiring', 'engineers'],
        },
      ],
      rawData: {},
    },
    {
      id: '2',
      name: 'John Smith',
      source: 'LinkedIn',
      confidenceScore: 72,
      signals: [
        {
          type: 'COMPANY',
          text: 'We are a tech company',
          confidence: 0.72,
          patterns: ['company'],
          keywords: ['tech', 'company'],
        },
      ],
      rawData: {},
    },
    {
      id: '3',
      name: 'Alice Johnson',
      source: 'Twitter',
      confidenceScore: 88,
      signals: [
        {
          type: 'INDIVIDUAL',
          text: 'I am looking for opportunities',
          confidence: 0.88,
          patterns: ['individual'],
          keywords: ['looking', 'opportunities'],
        },
      ],
      rawData: {},
    },
  ],
  metadata: {
    totalProcessed: 150,
    totalQualified: 3,
    executionTimeMs: 1234,
    filters: {
      minimumConfidence: 70,
      signalTypes: ['HIRING', 'COMPANY', 'INDIVIDUAL'],
    },
  },
};

describe('IntelligenceView', () => {
  it('renders empty state when no results', () => {
    mockLocation.mockReturnValue({ state: null });

    render(
      <BrowserRouter>
        <IntelligenceView />
      </BrowserRouter>
    );

    expect(screen.getByText(/no candidates found/i)).toBeInTheDocument();
  });

  it('displays candidate table when results are provided', () => {
    mockLocation.mockReturnValue({ state: { results: mockResults } });

    render(
      <BrowserRouter>
        <IntelligenceView />
      </BrowserRouter>
    );

    // Check header
    expect(screen.getByText('Intelligence Results')).toBeInTheDocument();
    expect(screen.getByText(/found 3 qualified candidates/i)).toBeInTheDocument();

    // Check table headers
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText(/Confidence/)).toBeInTheDocument();
    expect(screen.getByText('Signal Type')).toBeInTheDocument();
    expect(screen.getByText('Source')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('displays candidates sorted by confidence descending by default', () => {
    mockLocation.mockReturnValue({ state: { results: mockResults } });

    render(
      <BrowserRouter>
        <IntelligenceView />
      </BrowserRouter>
    );

    const rows = screen.getAllByRole('row');
    // Skip header row (index 0)
    const firstDataRow = rows[1];
    const secondDataRow = rows[2];
    const thirdDataRow = rows[3];

    // Check order: 95% (Jane) > 88% (Alice) > 72% (John)
    expect(firstDataRow).toHaveTextContent('Jane Doe');
    expect(firstDataRow).toHaveTextContent('95%');

    expect(secondDataRow).toHaveTextContent('Alice Johnson');
    expect(secondDataRow).toHaveTextContent('88%');

    expect(thirdDataRow).toHaveTextContent('John Smith');
    expect(thirdDataRow).toHaveTextContent('72%');
  });

  it('displays correct signal type badges with proper colors', () => {
    mockLocation.mockReturnValue({ state: { results: mockResults } });

    const { container } = render(
      <BrowserRouter>
        <IntelligenceView />
      </BrowserRouter>
    );

    // Check signal badges are rendered
    expect(screen.getByText('HIRING')).toBeInTheDocument();
    expect(screen.getByText('COMPANY')).toBeInTheDocument();
    expect(screen.getByText('INDIVIDUAL')).toBeInTheDocument();

    // Check background colors are applied
    const hiringBadge = screen.getByText('HIRING');
    const companyBadge = screen.getByText('COMPANY');
    const individualBadge = screen.getByText('INDIVIDUAL');

    expect(hiringBadge).toHaveStyle({ backgroundColor: '#22c55e' }); // green
    expect(companyBadge).toHaveStyle({ backgroundColor: '#3b82f6' }); // blue
    expect(individualBadge).toHaveStyle({ backgroundColor: '#a855f7' }); // purple
  });

  it('displays confidence bars with correct width', () => {
    mockLocation.mockReturnValue({ state: { results: mockResults } });

    const { container } = render(
      <BrowserRouter>
        <IntelligenceView />
      </BrowserRouter>
    );

    const confidenceBars = container.querySelectorAll('.confidence-bar');
    expect(confidenceBars).toHaveLength(3);

    // Check widths match confidence scores
    expect(confidenceBars[0]).toHaveStyle({ width: '95%' }); // Jane: 95
    expect(confidenceBars[1]).toHaveStyle({ width: '88%' }); // Alice: 88
    expect(confidenceBars[2]).toHaveStyle({ width: '72%' }); // John: 72
  });

  it('shows confidence values as percentages', () => {
    mockLocation.mockReturnValue({ state: { results: mockResults } });

    render(
      <BrowserRouter>
        <IntelligenceView />
      </BrowserRouter>
    );

    expect(screen.getByText('95%')).toBeInTheDocument();
    expect(screen.getByText('88%')).toBeInTheDocument();
    expect(screen.getByText('72%')).toBeInTheDocument();
  });

  it('displays source information', () => {
    mockLocation.mockReturnValue({ state: { results: mockResults } });

    render(
      <BrowserRouter>
        <IntelligenceView />
      </BrowserRouter>
    );

    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.getByText('LinkedIn')).toBeInTheDocument();
    expect(screen.getByText('Twitter')).toBeInTheDocument();
  });
});
