/**
 * Unit tests for useProcessSourcing hook
 */
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useProcessSourcing } from '../sourcing';
import { apiClient } from '../client';
import type { ProcessRequest, ProcessResponse } from '../../types/api';

// Mock axios client
vi.mock('../client', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

// Helper to create wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useProcessSourcing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully process sourcing request', async () => {
    const mockRequest: ProcessRequest = {
      keywords: ['Senior Engineer', 'TypeScript'],
      rssFeedUrls: ['https://example.com/feed'],
      filters: {
        minimumConfidence: 70,
        signalTypes: ['HIRING', 'COMPANY'],
      },
    };

    const mockResponse: ProcessResponse = {
      status: 'completed',
      results: {
        candidates: [
          {
            id: '1',
            name: 'Jane Doe',
            source: 'HackerNews',
            confidenceScore: 85,
            signals: [
              {
                type: 'HIRING',
                text: 'We are hiring Senior Engineers',
                confidence: 0.9,
                patterns: ['hiring'],
                keywords: ['Senior Engineer'],
              },
            ],
            rawData: {},
          },
        ],
        metadata: {
          totalProcessed: 100,
          totalQualified: 1,
          executionTimeMs: 5000,
          filters: mockRequest.filters,
        },
      },
    };

    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: mockResponse });

    const onSuccess = vi.fn();
    const { result } = renderHook(() => useProcessSourcing({ onSuccess }), {
      wrapper: createWrapper(),
    });

    result.current.mutate(mockRequest);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockResponse);
    expect(onSuccess).toHaveBeenCalled();
    expect(onSuccess.mock.calls[0][0]).toEqual(mockResponse);
    expect(apiClient.post).toHaveBeenCalledWith('/api/v1/process', mockRequest);
  });

  it('should handle API errors gracefully', async () => {
    const mockRequest: ProcessRequest = {
      keywords: [],
      rssFeedUrls: [],
      filters: {
        minimumConfidence: 70,
        signalTypes: ['HIRING'],
      },
    };

    const mockError = new Error('Invalid request: keywords array cannot be empty');
    vi.mocked(apiClient.post).mockRejectedValueOnce(mockError);

    const onError = vi.fn();
    const { result } = renderHook(() => useProcessSourcing({ onError }), {
      wrapper: createWrapper(),
    });

    result.current.mutate(mockRequest);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual(mockError);
    expect(onError).toHaveBeenCalled();
    expect(onError.mock.calls[0][0]).toEqual(mockError);
  });

  it('should track pending state during mutation', async () => {
    const mockRequest: ProcessRequest = {
      keywords: ['Engineer'],
      rssFeedUrls: ['https://example.com/feed'],
      filters: {
        minimumConfidence: 50,
        signalTypes: ['HIRING'],
      },
    };

    let resolvePromise: (value: any) => void;
    const promise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    vi.mocked(apiClient.post).mockReturnValueOnce(promise as any);

    const { result } = renderHook(() => useProcessSourcing(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isPending).toBe(false);

    result.current.mutate(mockRequest);

    await waitFor(() => expect(result.current.isPending).toBe(true));

    resolvePromise!({ data: { status: 'completed', results: { candidates: [], metadata: {} } } });

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.isSuccess).toBe(true);
  });

  it('should handle CORS errors with user-friendly message', async () => {
    const mockRequest: ProcessRequest = {
      keywords: ['Engineer'],
      rssFeedUrls: ['https://example.com/feed'],
      filters: {
        minimumConfidence: 50,
        signalTypes: ['HIRING'],
      },
    };

    // Simulate CORS error (Network Error from axios interceptor)
    const corsError = new Error('Unable to connect to backend. Check that the API server is running and CORS is configured.');
    vi.mocked(apiClient.post).mockRejectedValueOnce(corsError);

    const onError = vi.fn();
    const { result } = renderHook(() => useProcessSourcing({ onError }), {
      wrapper: createWrapper(),
    });

    result.current.mutate(mockRequest);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toContain('Unable to connect to backend');
    expect(onError).toHaveBeenCalled();
  });
});
