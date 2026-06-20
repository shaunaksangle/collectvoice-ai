# CollectVoice AI Architecture

CollectVoice AI is built as a modular mock-first system. The current architecture lets the team demo the complete collection workflow without enabling real calls.

## Frontend

The frontend is a React + TypeScript + Vite app styled with Tailwind CSS.

Main areas:

- Dashboard
- Cases
- Campaigns
- Call Queue
- Mock Calls
- Promise To Pay
- Human Callbacks
- Settings

The frontend talks to the backend over REST. The default API base URL is:

```text
http://127.0.0.1:8000/api/v1
```

The API client is in:

```text
frontend/src/lib/api.ts
```

## Backend

The backend is a FastAPI app using SQLAlchemy models and Alembic migrations.

Main backend areas:

- `app/api/v1/endpoints`: FastAPI routers.
- `app/schemas`: Pydantic request and response schemas.
- `app/models`: SQLAlchemy models.
- `app/services`: business/service logic.
- `app/core`: settings and configuration.
- `app/db`: database engine and session setup.

The backend exposes Swagger docs at:

```text
http://127.0.0.1:8000/docs
```

## PostgreSQL

PostgreSQL is the system of record for:

- Customers
- Cases
- Campaigns
- Campaign-case links
- Call attempts
- Call outcomes
- Promise To Pay records
- Human Callback records
- Audit log model foundation

Local PostgreSQL is provided by Docker Compose.

## Redis

Redis is included in Docker Compose for future queue, worker, or caching needs.

Current status:

- Redis is available locally.
- The current mock workflow does not require a live background worker.
- Call queue records are stored in PostgreSQL.

## Mock Provider Layer

The provider interfaces are present so real providers can be added later without rewriting the app workflow.

Interfaces:

- `SpeechToTextService`
- `TextToSpeechService`
- `LLMService`
- `TelephonyService`

Mock implementations:

- `MockSpeechToTextService`
- `MockTextToSpeechService`
- `MockLLMService`
- `MockTelephonyService`

Current behavior:

- No external API calls.
- No phone calls.
- Mock transcripts and outcomes are generated locally.

## Future Sarvam And Telephony Provider Layer

Future production integrations should implement the existing provider interfaces.

Likely future adapters:

- Sarvam STT adapter.
- Sarvam TTS adapter.
- Production LLM adapter with compliance prompts and guardrails.
- Exotel, Twilio, LiveKit, or another telephony adapter.

Provider selection should remain environment-driven:

```env
VOICE_MODE=mock
SARVAM_API_KEY=
TELEPHONY_PROVIDER=mock
TELEPHONY_API_KEY=
```

Production integration should also add:

- Consent checks.
- Calling-hour rules.
- Retry rules.
- Do-not-call handling.
- Provider webhook verification.
- Call recording and transcript retention policy.

## Data Flow

```text
Cases
  -> Campaigns
  -> Call Queue
  -> Mock Calls
  -> Call Outcomes
  -> Promise To Pay / Human Callbacks
```

### 1. Cases

Managers upload CSV/XLSX files. The backend normalizes columns, validates rows, previews errors, and commits valid rows into `customers` and `cases`.

### 2. Campaigns

Managers create campaigns and attach existing cases by explicit case IDs or filters.

Campaigns do not start calls.

### 3. Call Queue

Managers generate call queue records from campaign cases.

Each attached case becomes a `CallAttempt` if it has a phone number and is not already active in the campaign queue.

### 4. Mock Calls

A pending or scheduled call attempt can be run in mock mode.

The mock call service:

- Marks the call attempt in progress.
- Generates a safe transcript and outcome.
- Finalizes the attempt as completed or failed.
- Saves a `CallOutcome`.

### 5. Outcomes

Outcomes include:

- `promise_to_pay`
- `already_paid`
- `callback_requested`
- `no_answer`
- `wrong_number`
- `dispute`
- `refused_to_pay`
- `unreachable`

### 6. Promise To Pay And Human Callbacks

The mock call service creates follow-up records when needed:

- `promise_to_pay` creates a Promise To Pay record.
- `callback_requested` creates a Human Callback record.
- `dispute` creates a Human Callback record.

Managers can review and update these follow-ups in the frontend.

## Current Boundaries

Implemented:

- Local REST APIs.
- PostgreSQL persistence.
- Mock call execution.
- Manager frontend pages.
- Demo seed/reset utilities.

Not implemented yet:

- Authentication.
- Real calling.
- Sarvam integration.
- Telephony provider webhooks.
- Background workers.
- Production deployment.
- Production compliance workflow.
