"""FastAPI backend for CodeSignal talent sourcing integration."""

import subprocess
import json
from typing import Dict, Any, List
from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

app = FastAPI(
    title="Sourcing Mission Control API",
    description="Backend service for CodeSignal talent sourcing",
    version="1.0.0",
)


# Pydantic models for request/response validation
class HealthResponse(BaseModel):
    """Health check response schema."""
    status: str


class SignalSchema(BaseModel):
    """Schema for a talent signal."""
    type: str = Field(..., description="Signal type: HIRING, COMPANY, or INDIVIDUAL")
    text: str = Field(..., description="Description of the signal")
    confidence: float = Field(..., ge=0, le=100, description="Confidence score 0-100")
    patterns: List[str] = Field(default_factory=list, description="Detected patterns")
    keywords: List[str] = Field(default_factory=list, description="Matched keywords")


class CandidateSchema(BaseModel):
    """Schema for a scored candidate."""
    id: str = Field(..., description="Unique candidate identifier")
    name: str = Field(..., description="Candidate name")
    source: str = Field(..., description="Source URL or platform")
    confidenceScore: float = Field(..., ge=0, le=100, description="Overall confidence score")
    signals: List[SignalSchema] = Field(default_factory=list, description="Detected signals")
    rawData: Dict[str, Any] = Field(default_factory=dict, description="Raw candidate data")


class ProcessingFilters(BaseModel):
    """Filters for candidate processing."""
    minimumConfidence: float = Field(default=0, ge=0, le=100)
    signalTypes: List[str] = Field(default_factory=list, description="Signal types to filter for")


class ProcessRequest(BaseModel):
    """Request schema for /api/v1/process endpoint."""
    keywords: List[str] = Field(..., description="Search keywords")
    rssFeedUrls: List[str] = Field(default_factory=list, description="RSS feed URLs to process")
    filters: ProcessingFilters = Field(default_factory=ProcessingFilters, description="Processing filters")


class ProcessingMetadata(BaseModel):
    """Metadata about the processing operation."""
    totalProcessed: int = Field(..., description="Total items processed")
    candidatesFound: int = Field(..., description="Number of candidates found")
    executionTime: float = Field(..., description="Execution time in seconds")


class ProcessResponse(BaseModel):
    """Response schema for /api/v1/process endpoint."""
    status: str = Field(..., description="Processing status: completed or error")
    results: Dict[str, Any] = Field(..., description="Results containing candidates and metadata")


@app.get("/api/v1/health", response_model=HealthResponse)
async def health_check() -> Dict[str, str]:
    """
    Health check endpoint to verify backend is running.

    Returns:
        Dict containing status field set to 'ok'
    """
    return {"status": "ok"}


@app.post("/api/v1/process", response_model=ProcessResponse)
async def process_sourcing(request: ProcessRequest) -> JSONResponse:
    """
    Process sourcing configuration and return scored candidates.

    This endpoint triggers the CodeSignal agent (TypeScript) to score candidates
    based on provided keywords and filters.

    Args:
        request: ProcessRequest containing keywords, rssFeedUrls, and filters

    Returns:
        JSONResponse with status, candidates array, and metadata

    Raises:
        HTTPException: 400 for invalid input, 500 for processing errors
    """
    try:
        # Validate input
        if not request.keywords:
            raise HTTPException(
                status_code=400,
                detail="At least one keyword is required"
            )

        # Build command to run TypeScript CodeSignal agent
        # For now, return mock data until we wire up the actual agent
        # TODO: Replace with actual subprocess call to TypeScript agent

        # Mock response matching the schema
        mock_candidates = [
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
        ]

        response_data = {
            "status": "completed",
            "results": {
                "candidates": mock_candidates,
                "metadata": {
                    "totalProcessed": 100,
                    "candidatesFound": 1,
                    "executionTime": 2.5
                }
            }
        }

        return JSONResponse(content=response_data, status_code=200)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Processing error: {str(e)}"
        )
