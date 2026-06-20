# CollectVoice AI

CollectVoice AI is a foundation for an AI voice calling system for small debt collection teams. This version intentionally implements only the base architecture, mock-ready service boundaries, database schema, case upload management, and dashboard shell. Real Sarvam, Exotel, Twilio, or LiveKit integrations can be added later behind the provider interfaces.

## Project Structure

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
|   |       |-- cases/
|   |       |-- interfaces/
|   |       `-- mocks/
|   |-- scripts/
|   |-- alembic.ini
|   `-- requirements.txt
|-- frontend/
|-- .env.example
|-- docker-compose.yml
`-- README.md
```

## Prerequisites

- Docker Desktop
- Python 3.11+
- Node.js 20+

## Environment

```powershell
Copy-Item .env.example .env
```

`VOICE_MODE` defaults to `mock`. Keep it as `mock` until real speech, LLM, and telephony providers are implemented.

Future credentials belong in `.env`:

```env
SARVAM_API_KEY=
TELEPHONY_PROVIDER=mock
TELEPHONY_API_KEY=
```

Do not commit `.env`.

## Start PostgreSQL and Redis

```powershell
docker compose up -d
```

PostgreSQL runs on `localhost:5432` and Redis runs on `localhost:6379`.

## Start the Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

Backend endpoints:

- `GET http://localhost:8000/health`
- `GET http://localhost:8000/api/v1/status`
- `GET http://localhost:8000/api/v1/cases/summary`
- `GET http://localhost:8000/api/v1/cases`
- `GET http://localhost:8000/api/v1/cases/{case_id}`
- `POST http://localhost:8000/api/v1/cases/upload/preview`
- `POST http://localhost:8000/api/v1/cases/upload/commit`
- `POST http://localhost:8000/api/v1/campaigns`
- `GET http://localhost:8000/api/v1/campaigns`
- `GET http://localhost:8000/api/v1/campaigns/{campaign_id}`
- `PATCH http://localhost:8000/api/v1/campaigns/{campaign_id}`
- `DELETE http://localhost:8000/api/v1/campaigns/{campaign_id}`
- `POST http://localhost:8000/api/v1/campaigns/{campaign_id}/cases`
- `GET http://localhost:8000/api/v1/campaigns/{campaign_id}/eligible-cases`
- `GET http://localhost:8000/api/v1/campaigns/summary`
- `POST http://localhost:8000/api/v1/call-queue/generate/{campaign_id}`
- `GET http://localhost:8000/api/v1/call-queue`
- `GET http://localhost:8000/api/v1/call-queue/{call_attempt_id}`
- `PATCH http://localhost:8000/api/v1/call-queue/{call_attempt_id}`
- `POST http://localhost:8000/api/v1/call-queue/{call_attempt_id}/cancel`
- `GET http://localhost:8000/api/v1/call-queue/summary`
- `GET http://localhost:8000/api/v1/mock-calls/outcomes`
- `GET http://localhost:8000/api/v1/mock-calls/outcomes/{outcome_id}`
- `GET http://localhost:8000/api/v1/mock-calls/summary`
- `POST http://localhost:8000/api/v1/mock-calls/run-batch`
- `POST http://localhost:8000/api/v1/mock-calls/run/{call_attempt_id}`
- `GET http://localhost:8000/api/v1/promise-to-pay`
- `GET http://localhost:8000/api/v1/promise-to-pay/{ptp_id}`
- `PATCH http://localhost:8000/api/v1/promise-to-pay/{ptp_id}`
- `GET http://localhost:8000/api/v1/promise-to-pay/summary`
- `GET http://localhost:8000/api/v1/human-callbacks`
- `GET http://localhost:8000/api/v1/human-callbacks/{callback_id}`
- `PATCH http://localhost:8000/api/v1/human-callbacks/{callback_id}`
- `GET http://localhost:8000/api/v1/human-callbacks/summary`

## Case Upload Preview

Use Swagger at `http://localhost:8000/docs`, open `POST /api/v1/cases/upload/preview`, choose a `.csv` or `.xlsx` file, and execute.

Preview parses and validates the file only. It does not save rows to PostgreSQL.

The response includes:

- `total_rows`
- `valid_rows`
- `invalid_rows`
- `duplicate_rows`
- `errors`
- `normalized_columns`
- `preview_data`

## Case Upload Commit

Use Swagger at `http://localhost:8000/docs`, open `POST /api/v1/cases/upload/commit`, choose the same `.csv` or `.xlsx` file, and execute.

Commit reuses the same parser, column normalization, and validation as preview. It saves only valid rows.

Commit behavior:

- Invalid rows are skipped.
- Duplicate `case_reference` rows inside the uploaded file are skipped.
- Existing database `case_reference` values are skipped and returned in `existing_case_references`.
- Customers are matched by `phone_number`.
- Existing customers are updated only when new basic details are provided.
- New customers are created when the phone number does not exist.

The response includes:

- `total_rows`
- `saved_rows`
- `skipped_rows`
- `invalid_rows`
- `duplicate_rows`
- `errors`
- `saved_cases`
- `existing_case_references`
- `message`

## Expected Case Upload Columns

| Canonical field | Supported aliases |
| --- | --- |
| `customer_name` | `customer_name`, `name`, `borrower_name` |
| `phone_number` | `phone`, `mobile`, `mobile_number`, `contact_number`, `phone_number` |
| `case_reference` | `case_id`, `case_reference`, `loan_id`, `account_number`, `agreement_id` |
| `lender_name` | `lender`, `lender_name`, `bank`, `nbfc`, `client` |
| `outstanding_amount` | `outstanding`, `outstanding_amount`, `due_amount`, `pending_amount`, `amount_due` |
| `emi_amount` | `emi`, `emi_amount`, `installment_amount` |
| `due_date` | `due_date`, `payment_due_date`, `emi_due_date` |
| `dpd` | `dpd`, `days_past_due`, `overdue_days` |
| `priority` | `priority`, `risk`, `risk_level` |
| `assigned_agent` | `agent`, `assigned_agent`, `collector` |
| `status` | `status`, `case_status` |
| `city` | `city`, `location` |
| `state` | `state` |
| `email` | `email`, `email_id` |
| `alternate_phone` | `alternate_phone`, `alt_phone`, `secondary_mobile` |

Required fields:

- `customer_name`
- `phone_number`
- `case_reference`
- `outstanding_amount`

## Minimal CSV Example

```csv
customer_name,phone_number,case_reference,outstanding_amount
Asha Rao,9876543210,LOAN-1001,12000.50
Rahul Mehta,9876543211,LOAN-1002,9000
```

## Campaign Management API

Campaigns prepare saved cases for future call queue generation. Creating, updating, and attaching cases does not start calls.

Create a campaign in Swagger at `POST /api/v1/campaigns`:

```json
{
  "name": "Demo Bank high DPD follow-up",
  "description": "Foundation campaign for overdue accounts",
  "status": "draft",
  "campaign_type": "payment_follow_up",
  "lender_name": "Demo Bank",
  "priority_filter": "high",
  "min_dpd": 1
}
```

Attach explicit cases at `POST /api/v1/campaigns/{campaign_id}/cases`:

```json
{
  "case_ids": ["case-id-1", "case-id-2"]
}
```

Attach by filters using the same endpoint:

```json
{
  "lender_name": "Demo Bank",
  "priority_filter": "high",
  "min_dpd": 1,
  "max_dpd": 90
}
```

If no `case_ids` or request filters are provided, the backend uses the campaign's saved filters. Existing campaign-case links are skipped rather than duplicated. Deleting a campaign archives it by setting `status` to `archived`.

## Call Queue API

The call queue prepares campaign cases for a future mock calling worker. It does not start calls and does not call any external provider.

Generate queue items from a campaign's attached cases in Swagger at `POST /api/v1/call-queue/generate/{campaign_id}`:

```json
{}
```

To schedule the generated items immediately, provide `scheduled_at`:

```json
{
  "scheduled_at": "2026-06-20T10:00:00+05:30"
}
```

Generation behavior:

- One pending or scheduled `CallAttempt` is created per attached case.
- Cases with missing phone numbers are skipped.
- Existing pending or scheduled attempts for the same campaign and case are skipped.
- Running generation again for the same campaign does not duplicate active queue items.

Use `GET /api/v1/call-queue` to list queue items. Supported filters include `campaign_id`, `status`, `priority`, `assigned_agent`, `lender_name`, `scheduled_from`, and `scheduled_to`.

Use `PATCH /api/v1/call-queue/{call_attempt_id}` to update status or `scheduled_at`, and `POST /api/v1/call-queue/{call_attempt_id}/cancel` to cancel pending or scheduled attempts.

## Mock Call Execution API

Mock calls simulate one safe, polite AI collection reminder from a pending or scheduled call attempt. They do not call Sarvam, Exotel, Twilio, LiveKit, or any external provider.

Run one mock call in Swagger at `POST /api/v1/mock-calls/run/{call_attempt_id}`:

```json
{
  "outcome_type": "promise_to_pay",
  "promise_date": "2026-06-25",
  "promise_amount": 2500,
  "notes": "Customer requested a reminder before payment date."
}
```

Supported `outcome_type` values:

- `promise_to_pay`
- `already_paid`
- `callback_requested`
- `no_answer`
- `wrong_number`
- `dispute`
- `refused_to_pay`
- `unreachable`

Behavior:

- Only `pending` or `scheduled` call attempts can be run.
- The call attempt is marked `in_progress`, then finalized as `completed` for connected outcomes.
- `no_answer` and `unreachable` finalize as `failed`.
- Every run creates a `CallOutcome`.
- `promise_to_pay` creates a `PromiseToPay`.
- `callback_requested` and `dispute` create a `HumanCallback`.

List saved outcomes at `GET /api/v1/mock-calls/outcomes`. Supported filters include `outcome_type`, `campaign_id`, `case_id`, `customer_id`, `callback_required`, and `human_review_required`.

View summary metrics at `GET /api/v1/mock-calls/summary`.

Preview a batch without changing data at `POST /api/v1/mock-calls/run-batch`:

```json
{
  "limit": 5,
  "status": "pending",
  "dry_run": true
}
```

Run a real mock batch:

```json
{
  "limit": 5,
  "campaign_id": "campaign-id",
  "status": "pending",
  "outcome_type": "no_answer",
  "dry_run": false
}
```

Batch processing only selects `pending` or `scheduled` attempts without existing outcomes. Completed or failed attempts are not processed again.

## Follow-up Management API

Promise To Pay and Human Callback records are created by mock calls now and can later be created by real calls. These endpoints let managers review and update those follow-ups.

List promise-to-pay records at `GET /api/v1/promise-to-pay`. Supported filters include `status`, `case_id`, `customer_id`, `assigned_agent`, `due_from`, `due_to`, and `overdue_only`.

Update a promise-to-pay record at `PATCH /api/v1/promise-to-pay/{ptp_id}`:

```json
{
  "status": "fulfilled",
  "notes": "Payment confirmed by manager."
}
```

View promise-to-pay metrics at `GET /api/v1/promise-to-pay/summary`.

List human callbacks at `GET /api/v1/human-callbacks`. Supported filters include `status`, `priority`, `assigned_agent`, `case_id`, and `customer_id`.

Update a callback at `PATCH /api/v1/human-callbacks/{callback_id}`:

```json
{
  "status": "assigned",
  "priority": "high",
  "assigned_agent": "Agent A",
  "notes": "Call customer after 6 PM."
}
```

View callback metrics at `GET /api/v1/human-callbacks/summary`.

## Demo Data Utilities

These scripts are for local development and presentation demos only. They do not drop tables and do not touch the Alembic version table, but reset deletes local workflow data from customers, cases, campaigns, call attempts, outcomes, promise-to-pay records, and human callbacks.

Run scripts from the `backend` folder after `alembic upgrade head`.

Seed fake Indian collection demo data:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python scripts\seed_demo_data.py
```

Reset local demo workflow data. This is intentionally guarded:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
$env:ALLOW_DEMO_RESET = "true"
python scripts\reset_demo_data.py
Remove-Item Env:\ALLOW_DEMO_RESET
```

Reseed clean demo data in one step:

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
$env:ALLOW_DEMO_RESET = "true"
python scripts\reseed_demo_data.py
Remove-Item Env:\ALLOW_DEMO_RESET
```

The seed creates 10 fake customers, 10 fake cases, 2 campaigns, campaign-case links, call queue items, and mock outcomes for `promise_to_pay`, `no_answer`, `dispute`, `already_paid`, and `callback_requested`. The mock outcomes create one Promise To Pay record and two Human Callback records through the existing mock call service.

## Start the Frontend

```powershell
cd frontend
npm install
npm run dev
```

The dashboard runs at `http://localhost:5173`.

## Mock Mode

The system is wired for mock mode first:

- `MockSpeechToTextService` returns a fixed transcript.
- `MockTextToSpeechService` returns a fake `mock://` audio URI.
- `MockLLMService` returns a safe placeholder response.
- `MockTelephonyService` returns fake provider call IDs.

No external API calls are made in mock mode.

## Provider Interfaces

Future integrations should implement these contracts:

- `SpeechToTextService`
- `TextToSpeechService`
- `LLMService`
- `TelephonyService`

Provider selection should remain environment-driven through `VOICE_MODE`, `SARVAM_API_KEY`, `TELEPHONY_PROVIDER`, and `TELEPHONY_API_KEY`.

## What Comes Next

1. Add authentication and role-based authorization.
2. Add case import history and commit audit logs.
3. Build frontend call attempt execution and outcome views.
4. Add real provider adapters for Sarvam and Exotel, Twilio, or LiveKit.
5. Add tests, observability, and compliance review workflows.
