import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ExecutionView } from '../ExecutionView';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock fetch
global.fetch = vi.fn();

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {ui}
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe('ExecutionView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders execute button', () => {
    renderWithProviders(<ExecutionView />);
    expect(screen.getByTestId('execute-button')).toBeInTheDocument();
    expect(screen.getByText('Execute Search')).toBeInTheDocument();
  });

  it('displays configuration summary', () => {
    renderWithProviders(
      <ExecutionView
        keywords={['React', 'TypeScript']}
        rssFeedUrls={['https://example.com/feed']}
        filters={{ minimumConfidence: 80, signalTypes: ['HIRING'] }}
      />
    );

    expect(screen.getByText(/React, TypeScript/)).toBeInTheDocument();
    expect(screen.getByText(/80%/)).toBeInTheDocument();
    expect(screen.getByText(/HIRING/)).toBeInTheDocument();
  });

  it('shows loading state when processing', async () => {
    // Mock pending request
    (global.fetch as any).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    renderWithProviders(<ExecutionView />);
    const button = screen.getByTestId('execute-button');

    await userEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText(/Processing/)).toBeInTheDocument();
      expect(button).toBeDisabled();
    });
  });

  it('navigates to IntelligenceView on success', async () => {
    const mockResults = {
      status: 'completed',
      results: {
        candidates: [{ id: '1', name: 'Test Candidate', confidenceScore: 90 }],
        metadata: { totalProcessed: 1 },
      },
    };

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResults,
    });

    renderWithProviders(<ExecutionView />);
    const button = screen.getByTestId('execute-button');

    await userEvent.click(button);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/intelligence', {
        state: { results: mockResults.results },
      });
    });
  });

  it('displays error toast on failure', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    renderWithProviders(<ExecutionView />);
    const button = screen.getByTestId('execute-button');

    await userEvent.click(button);

    await waitFor(() => {
      const toast = screen.getByTestId('error-toast');
      expect(toast).toBeInTheDocument();
      expect(toast).toHaveTextContent('Network error');
    });
  });

  it('button is disabled while processing', async () => {
    // Mock slow request
    (global.fetch as any).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    renderWithProviders(<ExecutionView />);
    const button = screen.getByTestId('execute-button');

    expect(button).not.toBeDisabled();

    await userEvent.click(button);

    // Should be disabled immediately after click
    expect(button).toBeDisabled();
  });
});
