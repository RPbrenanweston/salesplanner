# Railway Deployment Guide

This document describes how to deploy the Sourcing Mission Control application to Railway.

## Architecture

The application consists of two services:

1. **Backend** - FastAPI Python service (container deployment)
2. **Frontend** - React + Vite static site (static deployment)
3. **Database** - Railway Postgres (provisioned service)

---

## Prerequisites

- Railway account (https://railway.app)
- Railway CLI installed (optional, for debugging)
- Git repository connected to Railway

---

## Setup Steps

### 1. Create Railway Project

```bash
# Login to Railway (if using CLI)
railway login

# Create new project
railway init
```

Or use the Railway web dashboard to create a new project.

### 2. Provision Postgres Database

1. In Railway dashboard, click **"New"** → **"Database"** → **"Postgres"**
2. Railway will automatically create the database and provide a `DATABASE_URL` environment variable
3. This variable is automatically available to services in the same project

### 3. Deploy Backend Service

1. Click **"New"** → **"GitHub Repo"** → Select your repository
2. Railway will auto-detect the Python app
3. Set the following environment variables:

| Variable | Value | Description |
|----------|-------|-------------|
| `ALLOWED_ORIGINS` | `https://your-frontend.up.railway.app` | Replace with your actual Railway frontend domain (comma-separated for multiple origins) |
| `DATABASE_URL` | (auto-provided) | Railway automatically links this from Postgres service |

4. Configure build/start commands:
   - **Build Command**: `pip install -r backend/requirements.txt`
   - **Start Command**: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`

5. Set **Root Directory**: `backend/` (if Railway doesn't auto-detect)

### 4. Deploy Frontend Service

1. Click **"New"** → **"GitHub Repo"** → Select your repository again
2. Set the following environment variables:

| Variable | Value | Description |
|----------|-------|-------------|
| `VITE_API_URL` | `https://your-backend.up.railway.app` | Replace with your actual Railway backend domain |

3. Configure build/start commands:
   - **Build Command**: `cd frontend && npm install && npm run build`
   - **Start Command**: (Leave empty - Railway will serve static files from `frontend/dist`)
   - **Output Directory**: `frontend/dist`

4. Set **Root Directory**: `frontend/` (if Railway doesn't auto-detect)

---

## Environment Variables Reference

### Backend (`backend/.env.example`)

```bash
# CORS Configuration
ALLOWED_ORIGINS=https://your-frontend.up.railway.app

# Database (auto-provided by Railway Postgres)
DATABASE_URL=postgresql://user:password@host:port/database
```

### Frontend (`frontend/.env.example`)

```bash
# Backend API URL
VITE_API_URL=https://your-backend.up.railway.app
```

---

## Verification

After deployment, verify the services are running:

### Backend Health Check

```bash
curl https://your-backend.up.railway.app/api/v1/health
# Expected: {"status":"ok"}
```

### Frontend

1. Open `https://your-frontend.up.railway.app` in browser
2. Navigate to Execution View
3. Click "Execute Search" and verify it calls the backend

---

## Troubleshooting

### CORS Errors

**Problem**: Frontend shows CORS error when calling backend

**Solution**:
1. Check `ALLOWED_ORIGINS` in backend includes your frontend Railway domain
2. Ensure protocol matches (https vs http)
3. Restart backend service after changing environment variables

### Database Connection Errors

**Problem**: Backend fails to connect to Postgres

**Solution**:
1. Verify `DATABASE_URL` is set in backend environment variables
2. Check Railway Postgres service is running
3. Ensure backend and database are in the same Railway project

### Backend Not Starting

**Problem**: Backend service crashes on startup

**Solution**:
1. Check Railway logs: `railway logs --service backend`
2. Verify `requirements.txt` includes all dependencies
3. Check Python version compatibility (requires Python 3.11+)

### Frontend Shows 404 or Build Fails

**Problem**: Frontend doesn't load or build fails

**Solution**:
1. Verify build command includes `cd frontend`
2. Check `VITE_API_URL` is set correctly
3. Ensure output directory is `frontend/dist`
4. Verify `package.json` exists in `frontend/` directory

---

## Railway CLI Commands (Optional)

```bash
# View logs
railway logs --service backend
railway logs --service frontend

# Open service in browser
railway open

# Run command in Railway environment
railway run <command>

# Link local directory to Railway project
railway link
```

---

## Production Checklist

- [ ] Backend deployed and health check returns `{"status":"ok"}`
- [ ] Frontend deployed and loads in browser
- [ ] Postgres provisioned and `DATABASE_URL` available
- [ ] CORS configured with production frontend domain
- [ ] Frontend `.env.production` has correct `VITE_API_URL`
- [ ] End-to-end test: Execute search in production frontend
- [ ] Monitor Railway logs for errors

---

## Cost Optimization

Railway offers a free tier with usage limits. To optimize costs:

1. **Use Railway's Sleep Feature**: Services automatically sleep after inactivity
2. **Monitor Usage**: Check Railway dashboard for resource consumption
3. **Scale Appropriately**: Start with minimal resources, scale as needed

---

## Next Steps

After deployment:

1. Set up monitoring/alerting (Railway provides basic metrics)
2. Configure custom domains (optional)
3. Set up CI/CD for automatic deployments
4. Review Railway logs regularly for errors
