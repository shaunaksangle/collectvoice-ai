# Safety And Compliance

CollectVoice AI is currently mock-only. It does not make real phone calls and does not connect to Sarvam, Exotel, Twilio, LiveKit, or any telephony provider.

This document describes safety expectations for future production work.

## Current Safety Status

- Voice mode is `mock`.
- Telephony provider is `mock`.
- Mock calls generate local simulated transcripts.
- No external API is called for speech, LLM, or telephony.
- No customer is contacted by the current system.

## Conversation Principles

Debt collection conversations must remain polite, clear, and respectful.

The system must not generate or allow:

- Threats.
- Harassment.
- Shaming.
- Abuse.
- Legal pressure.
- Misleading claims.
- False urgency.
- Claims that payment is legally required without proper human/legal review.
- Claims that consequences will occur when they are not verified and approved.

## Required Human Handoff

Human review or callback should be required when the customer:

- Disputes the debt.
- Says the amount is wrong.
- Says they have already paid.
- Is angry or distressed.
- Asks legal questions.
- Requests a callback.
- Reports a wrong number.
- Requests documentation.
- Mentions hardship, vulnerability, or inability to pay.

## Production Requirements Before Real Calling

Before enabling real calls, the team should add:

- Authentication and role-based permissions.
- Consent and do-not-call controls.
- Calling-hours policy.
- Retry limits.
- Script and prompt safety review.
- Escalation rules.
- Audit logging for user actions.
- Provider webhook validation.
- Data retention policy for transcripts and recordings.
- Human review queues for sensitive outcomes.
- Monitoring and incident response.

## Mock Demo Positioning

When demoing the product, say clearly:

- This is a safe mock calling environment.
- No real phone calls are made.
- The transcripts are simulated.
- Sarvam and telephony providers can be connected later through provider interfaces.
- Compliance workflows must be completed before production calling.
