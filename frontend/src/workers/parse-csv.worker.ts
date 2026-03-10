/**
 * CSV Parser Web Worker
 * Runs PapaParse in a separate thread to avoid blocking the main UI thread
 * during large CSV file parsing.
 */

import Papa from 'papaparse';

interface ParseMessage {
  file: File;
  options?: any;
}

interface ParseResult {
  data: any[];
  meta: any;
  errors: any[];
}

// Listen for messages from main thread
self.onmessage = async (event: MessageEvent<ParseMessage>) => {
  try {
    const { file, options } = event.data;

    // Parse CSV using PapaParse
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      ...options,
      complete: (results: any) => {
        // Send parsed data back to main thread
        self.postMessage({
          success: true,
          data: results.data,
          meta: results.meta,
          errors: results.errors,
        } as ParseResult);
      },
      error: (error: any) => {
        // Send error back to main thread
        self.postMessage({
          success: false,
          error: error.message || 'Failed to parse CSV',
        });
      },
    });
  } catch (error) {
    // Handle unexpected errors
    self.postMessage({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
};
