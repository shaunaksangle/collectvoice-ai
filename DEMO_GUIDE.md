# CollectVoice AI Demo Guide

This guide is a 10-minute walkthrough for showing CollectVoice AI to a small debt collection agency. The system is a mock/demo MVP: it does not make real calls, does not use real customer data, and does not require production API keys.

## Before The Demo

Start PostgreSQL and Redis:

```powershell
docker compose up -d
```

Start the backend:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
alembic upgrade head
uvicorn app.main:app --reload
```

In a second terminal, reseed clean demo data:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
$env:ALLOW_DEMO_RESET = "true"
python scripts\reseed_demo_data.py
Remove-Item Env:\ALLOW_DEMO_RESET
```

The reseed script creates fake demo records only. Do not use real customer files or real agency data in a public demo.

Start the frontend:

```powershell
cd frontend
npm.cmd run dev
```

Open:

- Frontend: `http://127.0.0.1:5173`
- Swagger: `http://127.0.0.1:8000/docs`

## 10-Minute Demo Flow

### 1. Dashboard

Open the Dashboard first.

Show:

- Total cases and total outstanding amount.
- Campaign count.
- Call queue count.
- Completed and failed mock calls.
- Promise To Pay and Human Callback summaries.
- Mock mode badges: API Online, Mock Mode Active, Live Calling Disabled.

Talking point:

> This is the manager cockpit. It shows the full collection calling workflow, but the calling layer is still a safe simulation.

### 2. Cases

Open the Cases page.

Show:

- Saved demo cases.
- Search and filters.
- Outstanding amounts, DPD, priority, lender, and assigned agent.
- Upload preview/commit controls if you want to explain CSV/XLSX onboarding.

Talking point:

> Managers can upload portfolio files, validate rows, and commit valid cases into PostgreSQL.

### 3. Campaigns

Open the Campaigns page.

Show:

- Two seeded campaigns.
- Campaign status badges.
- Case count.
- View Details to show attached cases.

Talking point:

> Campaigns group existing cases before generating call queue items. Creating a campaign does not start calling.

### 4. Call Queue

Open the Call Queue page.

Show:

- Pending or scheduled call attempts.
- Campaign, customer, case reference, lender, priority, and status.
- Copy one pending or scheduled call attempt ID for the next step.

Talking point:

> The queue prepares call jobs. In production this is where a worker would pick up calls, but today we run mock calls manually.

### 5. Mock Calls

Open the Mock Calls page.

Run one mock call:

1. Paste a pending or scheduled `call_attempt_id`.
2. Choose an outcome type, for example `promise_to_pay` or `callback_requested`.
3. If using `promise_to_pay`, add a promise date and amount.
4. Click Run Mock Call.

Then show:

- Result summary.
- Outcomes table.
- View Details.
- Transcript block.

Talking point:

> This simulates a polite AI reminder call and stores the outcome. No external API and no phone call are used.

### 6. Promise To Pay

Open Promise To Pay.

Show:

- PTP summary cards.
- Pending promised amount.
- Customer, phone, lender, promised date, amount, and status.
- View Details and editable fields.

Talking point:

> Promise-to-pay commitments are trackable follow-ups for managers.

### 7. Human Callbacks

Open Human Callbacks.

Show:

- Pending and high-priority callback counts.
- Dispute/callback records.
- Assign, complete, or cancel actions.
- View Details and editable notes.

Talking point:

> Disputes, callback requests, and sensitive cases are routed to humans instead of being over-automated.

### 8. Settings

Open Settings.

Show:

- Voice mode is mock.
- Telephony provider is mock.
- Provider keys are not configured.

Talking point:

> Sarvam and telephony credentials can be added later through environment variables and provider interfaces.

## Close The Demo

Summarize the implemented workflow:

```text
Upload cases -> Create campaigns -> Generate queue -> Run mock calls -> Review outcomes -> Manage PTP and callbacks
```

Clarify future production work:

- Authentication and roles.
- Sarvam STT/TTS.
- Telephony provider integration.
- Compliance rules.
- Deployment and monitoring.

## Troubleshooting

If the Dashboard shows backend unavailable:

- Confirm the backend is running on `http://127.0.0.1:8000`.
- Confirm `alembic upgrade head` has run.
- Confirm Docker PostgreSQL is running.

If the frontend is blank or cannot load data:

- Restart `npm.cmd run dev`.
- Confirm `VITE_API_URL` points to `http://127.0.0.1:8000/api/v1` if using a custom frontend environment file.

If there is no demo data:

```powershell
cd backend
$env:ALLOW_DEMO_RESET = "true"
python scripts\reseed_demo_data.py
Remove-Item Env:\ALLOW_DEMO_RESET
```
