/**
 * React Query hook for CodeSignal sourcing backend integration
 */
import { useMutation } from '@tanstack/react-query';
import { apiClient } from './client';
import type { ProcessRequest, ProcessResponse } from '../types/api';

export interface UseProcessSourcingOptions {
  onSuccess?: (data: ProcessResponse) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook for processing sourcing requests via CodeSignal backend
 *
 * @example
 * const { mutate, isPending, isSuccess, data, error } = useProcessSourcing({
 *   onSuccess: (data) => navigate('/results', { state: { data } }),
 *   onError: (error) => toast.error(error.message)
 * });
 *
 * mutate({
 *   keywords: ['Senior Engineer', 'TypeScript'],
 *   rssFeedUrls: ['https://hn.algolia.com/api/v1/search_by_date?tags=job'],
 *   filters: {
 *     minimumConfidence: 70,
 *     signalTypes: ['HIRING', 'COMPANY']
 *   }
 * });
 */
export function useProcessSourcing(options?: UseProcessSourcingOptions) {
  return useMutation({
    mutationFn: async (request: ProcessRequest): Promise<ProcessResponse> => {
      const response = await apiClient.post<ProcessResponse>('/api/v1/process', request);
      return response.data;
    },
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  });
}
