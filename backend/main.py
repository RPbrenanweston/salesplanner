"""FastAPI backend for CodeSignal talent sourcing integration."""

from typing import Dict, Any
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(
    title="Sourcing Mission Control API",
    description="Backend service for CodeSignal talent sourcing",
    version="1.0.0",
)


# Pydantic models for request/response validation
class HealthResponse(BaseModel):
    """Health check response schema."""
    status: str


@app.get("/api/v1/health", response_model=HealthResponse)
async def health_check() -> Dict[str, str]:
    """
    Health check endpoint to verify backend is running.

    Returns:
        Dict containing status field set to 'ok'
    """
    return {"status": "ok"}
