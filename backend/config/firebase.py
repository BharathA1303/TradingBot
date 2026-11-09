"""
Auth compatibility shim — TradingBot uses JWT, not Firebase.
This module satisfies any remaining imports of verify_firebase_token.
"""
import logging
from typing import Optional
from services.jwt_service import decode_token

logger = logging.getLogger(__name__)


def init_firebase() -> None:
    logger.info("TradingBot uses JWT auth — Firebase not initialized")


def verify_firebase_token(token: str) -> Optional[dict]:
    """Decode a JWT token (replaces Firebase token verification)."""
    payload = decode_token(token)
    if not payload:
        return None
    # Map JWT claims to the shape the rest of the app expects
    return {
        "uid": str(payload.get("sub", "")),
        "email": payload.get("email", ""),
        "name": payload.get("name", ""),
        "picture": None,
        "email_verified": True,
        "firebase": {"sign_in_provider": "password"},
        "iss": "tradingbot",
        "sub": str(payload.get("sub", "")),
    }
