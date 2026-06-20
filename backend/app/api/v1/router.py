from fastapi import APIRouter

from app.api.v1.endpoints.call_queue import router as call_queue_router
from app.api.v1.endpoints.campaigns import router as campaigns_router
from app.api.v1.endpoints.cases import router as cases_router
from app.api.v1.endpoints.human_callbacks import router as human_callbacks_router
from app.api.v1.endpoints.mock_calls import router as mock_calls_router
from app.api.v1.endpoints.promise_to_pay import router as promise_to_pay_router
from app.api.v1.endpoints.status import router as status_router

api_router = APIRouter()
api_router.include_router(status_router, tags=["status"])
api_router.include_router(cases_router, prefix="/cases", tags=["cases"])
api_router.include_router(campaigns_router, prefix="/campaigns", tags=["campaigns"])
api_router.include_router(call_queue_router, prefix="/call-queue", tags=["call queue"])
api_router.include_router(mock_calls_router, prefix="/mock-calls", tags=["mock calls"])
api_router.include_router(promise_to_pay_router, prefix="/promise-to-pay", tags=["promise to pay"])
api_router.include_router(human_callbacks_router, prefix="/human-callbacks", tags=["human callbacks"])
