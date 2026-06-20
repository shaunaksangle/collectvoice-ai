from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal


@dataclass(frozen=True)
class MockCallScenario:
    outcome_type: str
    disposition: str
    detected_intent: str
    sentiment: str
    summary: str
    transcript: str
    callback_required: bool = False
    callback_reason: str | None = None
    human_review_required: bool = False
    next_action: str | None = None


def build_mock_call_scenario(
    *,
    outcome_type: str,
    customer_name: str,
    lender_name: str | None,
    outstanding_amount: Decimal,
    promise_date: date | None,
    promise_amount: Decimal | None,
    callback_reason: str | None,
) -> MockCallScenario:
    lender = lender_name or "your lender"
    amount_text = f"INR {outstanding_amount.quantize(Decimal('0.01'))}"
    customer = customer_name or "Customer"

    if outcome_type == "promise_to_pay":
        promised = promise_amount or outstanding_amount
        promise_text = promise_date.isoformat() if promise_date else "the agreed date"
        return MockCallScenario(
            outcome_type=outcome_type,
            disposition="connected",
            detected_intent="payment_commitment",
            sentiment="cooperative",
            summary=f"{customer} acknowledged the reminder and agreed to pay INR {promised.quantize(Decimal('0.01'))} by {promise_text}.",
            transcript=(
                f"Agent: Hello {customer}, this is a courteous payment reminder on behalf of {lender}. "
                "Is this a good time to speak briefly?\n"
                "Customer: Yes, please continue.\n"
                f"Agent: Thank you. Our records show an outstanding amount of {amount_text}. "
                "This is only a reminder, and I can note any payment plan you are comfortable sharing.\n"
                f"Customer: I can pay INR {promised.quantize(Decimal('0.01'))} by {promise_text}.\n"
                "Agent: Thank you. I have noted that commitment. Please use your usual official payment channel. "
                "Have a good day."
            ),
            next_action="track_promise_to_pay",
        )

    if outcome_type == "already_paid":
        return MockCallScenario(
            outcome_type=outcome_type,
            disposition="connected",
            detected_intent="payment_already_made",
            sentiment="neutral",
            summary=f"{customer} stated that payment has already been made and requested records to be checked.",
            transcript=(
                f"Agent: Hello {customer}, this is a polite reminder from {lender} about your account.\n"
                "Customer: I have already made the payment.\n"
                "Agent: Thank you for letting me know. I will mark this for verification. "
                "Please keep your payment receipt handy in case the team needs to confirm details."
            ),
            next_action="verify_payment",
        )

    if outcome_type == "callback_requested":
        reason = callback_reason or "Customer requested a callback at a more convenient time."
        return MockCallScenario(
            outcome_type=outcome_type,
            disposition="connected",
            detected_intent="callback_requested",
            sentiment="cooperative",
            summary=f"{customer} requested a human callback. Reason: {reason}",
            transcript=(
                f"Agent: Hello {customer}, I am calling with a courteous reminder from {lender}.\n"
                "Customer: I cannot talk right now. Can someone call me later?\n"
                "Agent: Of course. I will request a callback from the team at a more convenient time. Thank you."
            ),
            callback_required=True,
            callback_reason=reason,
            next_action="human_callback",
        )

    if outcome_type == "no_answer":
        return MockCallScenario(
            outcome_type=outcome_type,
            disposition="not_connected",
            detected_intent="no_answer",
            sentiment="unknown",
            summary="The call was not answered. No message beyond a safe reminder was recorded.",
            transcript="Agent: The call was not answered. No conversation took place.",
            next_action="retry_later",
        )

    if outcome_type == "wrong_number":
        return MockCallScenario(
            outcome_type=outcome_type,
            disposition="connected_wrong_party",
            detected_intent="wrong_number",
            sentiment="neutral",
            summary="The recipient indicated this was a wrong number. The record should be reviewed before any further attempt.",
            transcript=(
                "Agent: Hello, I am calling with a courteous account reminder. May I confirm I am speaking with the intended customer?\n"
                "Recipient: This is the wrong number.\n"
                "Agent: Thank you for clarifying. I will mark this for review and there will be no further discussion on this call."
            ),
            human_review_required=True,
            next_action="verify_contact_number",
        )

    if outcome_type == "dispute":
        reason = callback_reason or "Customer disputed the amount or account details."
        return MockCallScenario(
            outcome_type=outcome_type,
            disposition="connected",
            detected_intent="dispute",
            sentiment="concerned",
            summary=f"{customer} disputed the account details. A human review is required. Reason: {reason}",
            transcript=(
                f"Agent: Hello {customer}, I am calling with a respectful reminder from {lender}.\n"
                "Customer: I do not agree with this amount.\n"
                "Agent: Thank you for explaining. I will not debate the amount on this call. "
                "I will mark this for a human team member to review and contact you through the appropriate channel."
            ),
            callback_required=True,
            callback_reason=reason,
            human_review_required=True,
            next_action="human_review",
        )

    if outcome_type == "refused_to_pay":
        return MockCallScenario(
            outcome_type=outcome_type,
            disposition="connected",
            detected_intent="refused_to_pay",
            sentiment="unwilling",
            summary=f"{customer} declined to make a payment commitment during the mock call.",
            transcript=(
                f"Agent: Hello {customer}, this is a courteous reminder from {lender} about your account.\n"
                "Customer: I am not able to commit to a payment.\n"
                "Agent: I understand. I will note that no payment commitment was made today. Thank you for your time."
            ),
            next_action="manager_review",
        )

    return MockCallScenario(
        outcome_type="unreachable",
        disposition="not_connected",
        detected_intent="unreachable",
        sentiment="unknown",
        summary="The number was unreachable during the mock call attempt.",
        transcript="Agent: The number was unreachable. No conversation took place.",
        next_action="retry_later",
    )
