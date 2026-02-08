/**
 * API client configuration
 */
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds as per PRD requirement
});

// Add request interceptor for debugging
apiClient.interceptors.request.use(
  (config) => {
    console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`, config.data);
    return config;
  },
  (error) => {
    console.error('[API] Request error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    console.log(`[API] Response from ${response.config.url}:`, response.data);
    return response;
  },
  (error) => {
    if (error.code === 'ECONNABORTED') {
      console.error('[API] Request timeout');
      return Promise.reject(new Error('Request timeout - processing took longer than 30 seconds'));
    }

    if (error.response?.status === 0 || error.message === 'Network Error') {
      console.error('[API] CORS or network error');
      return Promise.reject(new Error('Unable to connect to backend. Check that the API server is running and CORS is configured.'));
    }

    const apiError = error.response?.data?.detail || error.message;
    console.error('[API] Response error:', apiError);
    return Promise.reject(new Error(apiError));
  }
);
