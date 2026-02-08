/**
 * API types matching backend Pydantic schemas
 */

export type SignalType = 'HIRING' | 'COMPANY' | 'INDIVIDUAL';

export interface Signal {
  type: SignalType;
  text: string;
  confidence: number;
  patterns: string[];
  keywords: string[];
}

export interface Candidate {
  id: string;
  name: string;
  source: string;
  confidenceScore: number; // 0-100
  signals: Signal[];
  rawData: Record<string, unknown>;
}

export interface ProcessingMetadata {
  totalProcessed: number;
  totalQualified: number;
  executionTimeMs: number;
  filters: ProcessingFilters;
}

export interface ProcessingFilters {
  minimumConfidence: number;
  signalTypes: SignalType[];
}

export interface ProcessRequest {
  keywords: string[];
  rssFeedUrls: string[];
  filters: ProcessingFilters;
}

export interface ProcessResponse {
  status: 'completed' | 'failed';
  results: {
    candidates: Candidate[];
    metadata: ProcessingMetadata;
  };
}

export interface HealthResponse {
  status: string;
}

export interface ApiError {
  detail: string;
}
