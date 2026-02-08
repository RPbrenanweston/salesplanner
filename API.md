# API Documentation

This document describes the REST API endpoints for the Sourcing Mission Control backend.

**Base URL (Development):** `http://localhost:8000`
**Base URL (Production):** `https://your-backend.up.railway.app`

---

## Endpoints

### GET /api/v1/health

Health check endpoint to verify the backend service is running.

**Request:**
```bash
curl http://localhost:8000/api/v1/health
```

**Response:**
```json
{
  "status": "ok"
}
```

**Status Codes:**
- `200 OK` - Service is healthy

---

### POST /api/v1/process

Process sourcing configuration and return scored candidates.

This endpoint triggers the CodeSignal agent to score candidates based on provided keywords and filters.

**Request:**

```bash
curl -X POST http://localhost:8000/api/v1/process \
  -H "Content-Type: application/json" \
  -d '{
    "keywords": ["typescript", "react"],
    "rssFeedUrls": ["https://example.com/feed.xml"],
    "filters": {
      "minimumConfidence": 70,
      "signalTypes": ["HIRING", "INDIVIDUAL"]
    }
  }'
```

**Request Schema:**

```typescript
interface ProcessRequest {
  keywords: string[];              // Required: Search keywords
  rssFeedUrls?: string[];          // Optional: RSS feed URLs to process
  filters?: ProcessingFilters;     // Optional: Processing filters
}

interface ProcessingFilters {
  minimumConfidence?: number;      // 0-100, default: 0
  signalTypes?: string[];          // Filter by signal types
}
```

**Response:**

```json
{
  "status": "completed",
  "results": {
    "candidates": [
      {
        "id": "candidate-001",
        "name": "Jane Smith",
        "source": "https://github.com/janesmith",
        "confidenceScore": 85.5,
        "signals": [
          {
            "type": "INDIVIDUAL",
            "text": "Active contributor to open source TypeScript projects",
            "confidence": 90.0,
            "patterns": ["consistent-commits", "code-quality"],
            "keywords": ["typescript", "react"]
          }
        ],
        "rawData": {
          "platform": "github",
          "languages": ["TypeScript", "Python"],
          "repos": 45
        }
      }
    ],
    "metadata": {
      "totalProcessed": 100,
      "candidatesFound": 1,
      "executionTime": 2.5
    }
  }
}
```

**Response Schema:**

```typescript
interface ProcessResponse {
  status: "completed" | "error";
  results: {
    candidates: Candidate[];
    metadata: ProcessingMetadata;
  };
}

interface Candidate {
  id: string;                      // Unique candidate identifier
  name: string;                    // Candidate name
  source: string;                  // Source URL or platform
  confidenceScore: number;         // Overall confidence score (0-100)
  signals: Signal[];               // Detected signals
  rawData: Record<string, any>;    // Raw candidate data
}

interface Signal {
  type: "HIRING" | "COMPANY" | "INDIVIDUAL";  // Signal type
  text: string;                    // Description of the signal
  confidence: number;              // Confidence score (0-100)
  patterns: string[];              // Detected patterns
  keywords: string[];              // Matched keywords
}

interface ProcessingMetadata {
  totalProcessed: number;          // Total items processed
  candidatesFound: number;         // Number of candidates found
  executionTime: number;           // Execution time in seconds
}
```

**Status Codes:**
- `200 OK` - Processing completed successfully
- `400 Bad Request` - Invalid input (e.g., empty keywords array)
- `500 Internal Server Error` - Processing error

**Error Response:**

```json
{
  "detail": "At least one keyword is required"
}
```

---

## Error Codes

| Status Code | Description | Common Causes |
|-------------|-------------|---------------|
| `200` | Success | Request completed successfully |
| `400` | Bad Request | Empty keywords array, invalid schema |
| `500` | Internal Server Error | CodeSignal agent failure, processing timeout |

---

## CORS Configuration

The backend accepts requests from the following origins (configurable via `ALLOWED_ORIGINS` environment variable):

**Development:**
- `http://localhost:3000` (React dev server)
- `http://localhost:5173` (Vite dev server)

**Production:**
- Your Railway frontend domain (e.g., `https://your-frontend.up.railway.app`)

---

## OpenAPI Documentation

FastAPI auto-generates interactive API documentation:

**Swagger UI:** `http://localhost:8000/docs`
**ReDoc:** `http://localhost:8000/redoc`

These endpoints provide interactive API exploration with request/response examples.

---

## Rate Limiting

Currently, no rate limiting is implemented. For production deployments, consider adding:
- Rate limiting middleware (e.g., `slowapi`)
- API key authentication
- Request throttling per client

---

## Authentication

Currently, the API is open and does not require authentication. For production deployments, consider adding:
- API key authentication
- JWT token validation
- OAuth 2.0 integration

---

## Versioning

The API uses URL versioning: `/api/v1/...`

Future versions will use `/api/v2/...` to maintain backward compatibility.

---

## Examples

### Basic Sourcing Request

```bash
curl -X POST http://localhost:8000/api/v1/process \
  -H "Content-Type: application/json" \
  -d '{
    "keywords": ["software engineer", "typescript"],
    "filters": {
      "minimumConfidence": 80
    }
  }'
```

### With RSS Feeds

```bash
curl -X POST http://localhost:8000/api/v1/process \
  -H "Content-Type: application/json" \
  -d '{
    "keywords": ["react", "senior"],
    "rssFeedUrls": [
      "https://stackoverflow.com/feeds/tag/react",
      "https://dev.to/feed/tag/react"
    ],
    "filters": {
      "minimumConfidence": 70,
      "signalTypes": ["HIRING", "INDIVIDUAL"]
    }
  }'
```

### Filter by Signal Types

```bash
curl -X POST http://localhost:8000/api/v1/process \
  -H "Content-Type: application/json" \
  -d '{
    "keywords": ["python", "machine learning"],
    "filters": {
      "signalTypes": ["INDIVIDUAL"]
    }
  }'
```

---

## Response Time

Expected response times:
- Health check: `< 50ms`
- Process endpoint: `< 30 seconds` (for 100-500 items processed)

For large datasets (1000+ items), consider implementing:
- Background job processing (Celery, RQ)
- WebSocket for real-time progress updates
- Pagination for results

---

## Database

The backend connects to Postgres via `DATABASE_URL` environment variable (automatically provided by Railway).

Database schema and migrations are not yet implemented. Future iterations will include:
- SQLAlchemy models
- Alembic migrations
- Candidate caching and persistence
