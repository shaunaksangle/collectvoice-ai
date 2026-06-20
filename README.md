# CollectVoice AI

CollectVoice AI is a mock-ready AI voice calling operations system for small debt collection teams. It helps managers upload collection cases, create campaigns, generate call queues, simulate safe AI calls, and review outcomes such as promise-to-pay commitments and human callback requests.

This repository is currently a local/demo foundation. It does not place real phone calls.

## Current System Status

- Mock mode only.
- No Sarvam integration is active yet.
- No Exotel, Twilio, LiveKit, or other telephony integration is active yet.
- No real calls are made.
- No authentication or role-based access control is implemented yet.
- PostgreSQL is used for application data.
- Redis is included in Docker Compose for future worker/queue use, but there is no live background calling worker yet.

## Tech Stack

Frontend:

- React
- TypeScript
- Vite
- Tailwind CSS
- lucide-react icons

Backend:

- FastAPI
- Python
- SQLAlchemy
- Alembic
- PostgreSQL
- Redis in local Docker Compose

Current API style:

- REST under `/api/v1`
- Swagger docs at `http://127.0.0.1:8000/docs`

## What Is Implemented

- Manager dashboard with real module summaries.
- Case upload preview and commit for CSV/XLSX files.
- Case list, detail, filters, and summary.
- Campaign creation, list, detail, archive, and case attachment.
- Call queue generation from campaign cases.
- Call queue list, detail, scheduling, cancellation, and summary.
- Mock call execution for one call attempt.
- Batch mock call execution.
- Mock call outcomes list, detail, transcript view, and summary.
- Promise To Pay list, detail, update, filters, and summary.
- Human Callback list, detail, update, filters, and summary.
- Local demo reset/seed/reseed scripts.
- Provider interface placeholders for future STT, TTS, LLM, and telephony services.

## Future Work

- Authentication and role-based access.
- Production compliance rule engine and review workflows.
- Real Sarvam STT/TTS adapters.
- Real telephony adapter for Exotel, Twilio, LiveKit, or another provider.
- Background workers for call execution.
- Deployment configuration.
- Monitoring, logging, tracing, and alerting.
- Audit trails for manager actions and case imports.

## Architecture Overview

The current system is deliberately modular:

```text
Frontend dashboard
  -> REST API
  -> FastAPI routers
  -> Services
  -> SQLAlchemy models
  -> PostgreSQL

Mock provider interfaces
  -> SpeechToTextService
  -> TextToSpeechService
  -> LLMService
  -> TelephonyService
```

Workflow:

```text
Cases -> Campaigns -> Call Queue -> Mock Calls -> Outcomes -> Promise To Pay / Human Callbacks
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for a fuller explanation.

## Folder Structure

```text
.
|-- backend/
|   |-- alembic/
|   |-- app/
|   |   |-- api/
|   |   |-- core/
|   |   |-- db/
|   |   |-- models/
|   |   |-- schemas/
|   |   `-- services/
|   |       |-- call_queue/
|   |       |-- campaigns/
|   |       |-- cases/
|   |       |-- followups/
|   |       |-- interfaces/
|   |       |-- mock_calls/
|   |       `-- mocks/
|   |-- scripts/
|   |-- alembic.ini
|   `-- requirements.txt
|-- frontend/
|   |-- src/
|   |   |-- components/
|   |   |-- lib/
|   |   |-- pages/
|   |   `-- types.ts
|   `-- package.json
|-- .env.example
|-- docker-compose.yml
|-- ARCHITECTURE.md
|-- DEMO_GUIDE.md
|-- SAFETY_AND_COMPLIANCE.md
`-- README.md
```

## Local Setup

Prerequisites:

- Docker Desktop
- Python 3.11+
- Node.js 20+

Create the environment file:

```powershell
Copy-Item .env.example .env
```

Keep `VOICE_MODE=mock` for the current build.

## Environment Variables

`.env.example` includes:

```env
DATABASE_URL=postgresql+psycopg://collectvoice:collectvoice@localhost:5432/collectvoice_ai
REDIS_URL=redis://localhost:6379/0
VOICE_MODE=mock
SARVAM_API_KEY=
TELEPHONY_PROVIDER=mock
TELEPHONY_API_KEY=
FRONTEND_ORIGIN=http://localhost:5173
VITE_API_URL=http://127.0.0.1:8000/api/v1
```

The frontend defaults to `http://127.0.0.1:8000/api/v1` if no Vite API variable is provided. If you need a different API URL for frontend development, create `frontend/.env.local` and set `VITE_API_URL`.

## Docker Services

Start PostgreSQL and Redis:

```powershell
docker compose up -d
```

Stop services:

```powershell
docker compose down
```

Services:

- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

## Backend Run Commands

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

Backend URLs:

- Health: `http://127.0.0.1:8000/health`
- API status: `http://127.0.0.1:8000/api/v1/status`
- Swagger: `http://127.0.0.1:8000/docs`

## Frontend Run Commands

```powershell
cd frontend
npm install
npm.cmd run dev
```

Frontend URL:

- `http://127.0.0.1:5173`

Production build check:

```powershell
cd frontend
npm.cmd run build
```

## Database Migration Commands

Run all migrations:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
alembic upgrade head
```

Show current revision:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
alembic current
```

Create a new migration only when a model/schema change is needed:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
alembic revision -m "describe_change"
```

## Demo Data Commands

These scripts are for local/demo databases only.

Seed fake Indian collection demo data:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python scripts\seed_demo_data.py
```

Reset local workflow data. This is intentionally guarded:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
$env:ALLOW_DEMO_RESET = "true"
python scripts\reset_demo_data.py
Remove-Item Env:\ALLOW_DEMO_RESET
```

Reseed clean demo data:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
$env:ALLOW_DEMO_RESET = "true"
python scripts\reseed_demo_data.py
Remove-Item Env:\ALLOW_DEMO_RESET
```

Reset deletes workflow data in safe order but does not drop database tables and does not touch the Alembic version table.

Seed creates:

- 10 fake customers
- 10 fake collection cases
- 2 campaigns
- Campaign-case links
- 10 call queue items
- 5 mock call outcomes
- 1 Promise To Pay record
- 2 Human Callback records

## Full Demo Workflow

1. Start Docker services.
2. Start the backend.
3. Run migrations.
4. Reseed demo data.
5. Start the frontend.
6. Open the Dashboard.
7. Show the Cases page.
8. Show the Campaigns page.
9. Show the Call Queue page.
10. Run one mock call from the Mock Calls page using a scheduled/pending call attempt ID.
11. Open the mock call outcome detail and show the transcript.
12. Show Promise To Pay records.
13. Show Human Callback records.
14. Open Settings and explain mock provider configuration.
15. Explain that Sarvam and telephony provider adapters can be connected later behind existing provider interfaces.

See [DEMO_GUIDE.md](DEMO_GUIDE.md) for a 10-minute scripted walkthrough.

## Core API Areas

- `GET /api/v1/status`
- `/api/v1/cases`
- `/api/v1/campaigns`
- `/api/v1/call-queue`
- `/api/v1/mock-calls`
- `/api/v1/promise-to-pay`
- `/api/v1/human-callbacks`

Use Swagger at `http://127.0.0.1:8000/docs` for request and response details.

## Case Upload Columns

Minimum required columns:

- `customer_name`
- `phone_number`
- `case_reference`
- `outstanding_amount`

Minimal CSV:

```csv
customer_name,phone_number,case_reference,outstanding_amount
Asha Rao,9876543210,LOAN-1001,12000.50
Rahul Mehta,9876543211,LOAN-1002,9000
```

Common aliases such as `name`, `borrower_name`, `mobile`, `loan_id`, `agreement_id`, `due_amount`, `emi`, `dpd`, `risk`, `agent`, and `case_status` are supported by the upload parser.

## Mock Mode

Mock mode means:

- Mock calls do not call external APIs.
- Mock calls do not dial real phone numbers.
- Mock speech, LLM, and telephony services return safe local placeholder data.
- Mock call transcripts are polite collection reminder simulations.

Read [SAFETY_AND_COMPLIANCE.md](SAFETY_AND_COMPLIANCE.md) before turning the system into a real calling product.

## Production Next Steps

- Add authentication and manager/agent/admin roles.
- Add Sarvam STT/TTS provider adapters.
- Add Exotel, Twilio, LiveKit, or chosen telephony adapter.
- Add consent, do-not-call, retry-window, and calling-hours rules.
- Add compliance review and safety testing for all conversation prompts.
- Add deployment configuration for backend, frontend, PostgreSQL, Redis, and workers.
- Add structured logging, monitoring, tracing, and alerting.
- Add audit logs for imports, campaign changes, queue generation, and follow-up updates.
