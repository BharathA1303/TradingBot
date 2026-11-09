"""
Authentication routes — JWT-based (email + password).
No Firebase, no 2FA, no Google sign-in.
"""
import logging
import hashlib
import re
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta

from database.connection import get_db
from models.user import User, UserSession, AdminAuditLog
from models.portfolio import Portfolio
from services.jwt_service import decode_token, create_access_token, hash_password, verify_password
from services import admin_group_service
from services.account_deletion_service import try_delete_firebase_account
from core.event_bus import event_bus, Event, EventType
from core.admin_runtime_flags import admin_runtime_flags
from config.settings import settings
from services.email_service import send_registration_received_email

logger = logging.getLogger(__name__)

_AUTO_APPROVAL_DURATION_DAYS = 30

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
security = HTTPBearer(auto_error=False)


# --- Helper Functions ---

def _coerce_utc_datetime(value):
    """Normalize DB datetime values across SQLite/Postgres to UTC-aware."""
    if value is None:
        return None

    dt = value
    if isinstance(value, str):
        raw = value.strip()
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"
        try:
            dt = datetime.fromisoformat(raw)
        except ValueError:
            return None

    if not isinstance(dt, datetime):
        return None

    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)

    return dt.astimezone(timezone.utc)


def _normalize_admin_email(email: str) -> str:
    """Normalize email for allowlist comparisons.

    For Gmail/Googlemail, treat dot/plus aliases as the same mailbox.
    """
    if not email:
        return ""

    normalized = email.strip().lower()
    if "@" not in normalized:
        return normalized

    local, domain = normalized.split("@", 1)
    if domain in {"gmail.com", "googlemail.com"}:
        local = local.split("+", 1)[0].replace(".", "")
        domain = "gmail.com"

    return f"{local}@{domain}"


def _is_admin_allowlisted(email: str) -> bool:
    normalized = _normalize_admin_email(email)
    if not normalized:
        return False

    allowlist = {
        _normalize_admin_email(e)
        for e in (settings.ADMIN_EMAIL_ALLOWLIST or [])
        if isinstance(e, str) and e.strip()
    }
    return normalized in allowlist


def _session_fingerprint(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


async def _upsert_user_session(
    db: AsyncSession,
    user: User,
    request: Request,
    token: str,
) -> None:
    """Create/update a user session row keyed by token fingerprint."""
    if not user or not token:
        return

    session_key = _session_fingerprint(token)
    ip_address = request.client.host if request and request.client else None
    user_agent = request.headers.get("user-agent", "")[:500] if request else ""
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(UserSession).where(UserSession.session_key == session_key)
    )
    session = result.scalar_one_or_none()

    if session:
        session.last_seen_at = now
        session.is_active = True
        session.ip_address = ip_address
        session.user_agent = user_agent
    else:
        try:
            async with db.begin_nested():
                db.add(
                    UserSession(
                        user_id=user.id,
                        session_key=session_key,
                        ip_address=ip_address,
                        user_agent=user_agent,
                        first_seen_at=now,
                        last_seen_at=now,
                        is_active=True,
                    )
                )
                await db.flush()
            return
        except IntegrityError:
            # Concurrent sync requests can race on the same token fingerprint.
            pass

        result = await db.execute(
            select(UserSession).where(UserSession.session_key == session_key)
        )
        existing = result.scalar_one_or_none()
        if existing:
            existing.last_seen_at = now
            existing.is_active = True
            existing.ip_address = ip_address
            existing.user_agent = user_agent


# --- Schemas ---

class LoginRequest(BaseModel):
    """Email + password login."""
    email: str
    password: str


class RegisterRequest(BaseModel):
    """Create account with email + password."""
    email: str
    password: str
    full_name: Optional[str] = None
    username: Optional[str] = None
    group_token: Optional[str] = None


class SyncRequest(BaseModel):
    """Kept for compatibility with old Firebase flow."""
    username: Optional[str] = None
    auth_intent: Optional[str] = None
    group_token: Optional[str] = None


class PhoneSubmitRequest(BaseModel):
    """Phone number submission — validated and saved as contact info."""
    phone: str  # 10-digit Indian mobile or +91XXXXXXXXXX


# --- Core Dependency: get_current_user ---

async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Verify JWT token and return the local User.

    Every protected route depends on this. The frontend sends the
    JWT token as a Bearer token in the Authorization header.
    """
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    # Look up local user by id (sub claim)
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        # Try by email as fallback
        email = payload.get("email", "")
        if email:
            result = await db.execute(select(User).where(User.email == email))
            user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=401,
            detail="User not found. Please sign in again.",
        )

    account_status = (getattr(user, "account_status", None) or "active").strip().lower()

    # account_status is the authoritative access gate.
    if account_status != "active":
        if account_status == "pending_approval":
            raise HTTPException(
                status_code=403,
                detail="PENDING_APPROVAL: Your account is under review. You will receive an email once approved.",
            )
        if account_status == "expired":
            raise HTTPException(
                status_code=403,
                detail="ACCESS_EXPIRED: Your demo trading access has expired. Contact support for extension.",
            )
        if account_status == "deactivated":
            raise HTTPException(
                status_code=403,
                detail="DEACTIVATED: Your account has been deactivated. Contact support for assistance.",
            )
        raise HTTPException(
            status_code=403,
            detail="ACCOUNT_RESTRICTED: Your account access is restricted. Contact support.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="DEACTIVATED: Your account has been deactivated. Contact support for assistance.",
        )

    # Check if access has expired (active user but past expiry date)
    if hasattr(user, "access_expires_at") and user.access_expires_at:
        expires_at = _coerce_utc_datetime(user.access_expires_at)
        if expires_at and datetime.now(timezone.utc) > expires_at:
            user.account_status = "expired"
            user.is_active = False
            await db.commit()
            raise HTTPException(
                status_code=403,
                detail="ACCESS_EXPIRED: Your demo trading access has expired. Contact support for extension.",
            )

    await _upsert_user_session(db, user, request, credentials.credentials)

    return user


async def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """
    Best-effort auth dependency for routes that can serve public-safe data.

    Returns a User when a valid JWT token is present, otherwise None.
    Never raises auth errors.
    """
    if not credentials:
        return None

    payload = decode_token(credentials.credentials)
    if not payload:
        return None

    user_id = payload.get("sub")
    if not user_id:
        return None

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return None

    account_status = (getattr(user, "account_status", None) or "active").strip().lower()
    if account_status != "active" or not user.is_active:
        return None

    if hasattr(user, "access_expires_at") and user.access_expires_at:
        expires_at = _coerce_utc_datetime(user.access_expires_at)
        if expires_at and datetime.now(timezone.utc) > expires_at:
            return None

    return user


# --- New Routes ---

@router.post("/login")
async def login(req: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Email + password login. Returns JWT token."""
    email = (req.email or "").strip().lower()
    if not email or not req.password:
        raise HTTPException(status_code=400, detail="Email and password are required")

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.password_hash:
        raise HTTPException(
            status_code=401,
            detail="This account was created with a different sign-in method."
        )

    if not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Check account_status
    account_status = (getattr(user, "account_status", None) or "active").strip().lower()
    if account_status == "deactivated":
        raise HTTPException(status_code=403, detail="DEACTIVATED: Your account has been deactivated.")

    # Issue JWT
    token = create_access_token({"sub": str(user.id), "email": user.email, "name": user.full_name})

    # Update session
    await _upsert_user_session(db, user, request, token)
    user.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)

    event_bus.emit_nowait(
        Event(
            type=EventType.USER_LOGIN,
            data={"user_id": str(user.id), "email": user.email, "action": "login", "provider": "password"},
            user_id=str(user.id),
            source="auth",
        )
    )

    return {
        "token": token,
        "message": "Login successful",
        "user": {
            "id": str(user.id),
            "email": user.email,
            "username": user.username,
            "full_name": user.full_name,
            "phone": user.phone,
            "role": user.role,
            "virtual_capital": float(user.virtual_capital),
            "avatar_url": user.avatar_url,
            "is_verified": user.is_verified,
            "auth_provider": user.auth_provider,
            "account_status": getattr(user, "account_status", "active"),
        },
    }


@router.post("/register")
async def register(req: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Create account with email + password. Returns JWT token."""
    email = (req.email or "").strip().lower()
    if not email or not req.password:
        raise HTTPException(status_code=400, detail="Email and password are required")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    admin_allowlisted = _is_admin_allowlisted(email)
    auto_approval_enabled = admin_runtime_flags.is_auto_approval_enabled()

    group_token = (req.group_token or "").strip()
    matched_group = None
    if group_token:
        try:
            matched_group = await admin_group_service.resolve_group_by_token(group_token)
        except Exception:
            matched_group = None

    group_auto_approval_enabled = bool(matched_group and matched_group.get("auto_approval"))
    effective_auto_approval = auto_approval_enabled or group_auto_approval_enabled

    # Check if email already exists
    result = await db.execute(select(User).where(User.email == email))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered. Try signing in.")

    # Generate username
    username = req.username
    if not username:
        username = email.split("@")[0]

    # Ensure username uniqueness
    base_username = username
    counter = 1
    while True:
        result = await db.execute(select(User).where(User.username == username))
        if not result.scalar_one_or_none():
            break
        username = f"{base_username}{counter}"
        counter += 1

    full_name = (req.full_name or username).strip()
    hashed = hash_password(req.password)

    try:
        user = User(
            email=email,
            username=username,
            full_name=full_name,
            password_hash=hashed,
            auth_provider="password",
            virtual_capital=settings.DEFAULT_VIRTUAL_CAPITAL,
            is_verified=True,
            role=("admin" if admin_allowlisted else "user"),
            account_status=(
                "active"
                if (admin_allowlisted or effective_auto_approval)
                else "pending_approval"
            ),
            is_active=(admin_allowlisted or effective_auto_approval),
            approved_at=(
                datetime.now(timezone.utc)
                if effective_auto_approval and not admin_allowlisted
                else None
            ),
            access_duration_days=(
                _AUTO_APPROVAL_DURATION_DAYS
                if effective_auto_approval and not admin_allowlisted
                else None
            ),
            access_expires_at=(
                datetime.now(timezone.utc) + timedelta(days=_AUTO_APPROVAL_DURATION_DAYS)
                if effective_auto_approval and not admin_allowlisted
                else None
            ),
        )
        db.add(user)
        await db.flush()

        # Create portfolio
        portfolio = Portfolio(
            user_id=user.id,
            available_capital=settings.DEFAULT_VIRTUAL_CAPITAL,
        )
        db.add(portfolio)

        # Issue JWT
        token = create_access_token({"sub": str(user.id), "email": user.email, "name": user.full_name})
        await _upsert_user_session(db, user, request, token)
        await db.commit()
        await db.refresh(user)

    except IntegrityError as e:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Email already registered.")
    except Exception as e:
        await db.rollback()
        logger.exception("Failed to create user during registration: %s", e)
        raise HTTPException(status_code=500, detail="Failed to create user account.")

    # Group assignment
    if user.role != "admin" and matched_group:
        try:
            await admin_group_service.assign_user_to_group(str(user.id), matched_group["id"])
        except Exception:
            logger.exception("Failed group assignment during register for user_id=%s", user.id)

    # Send registration email for pending users
    if not admin_allowlisted and not effective_auto_approval:
        try:
            send_registration_received_email(user)
        except Exception:
            logger.exception("Failed to send registration email for %s", user.email)

    try:
        event_bus.emit_nowait(
            Event(
                type=EventType.USER_LOGIN,
                data={"user_id": str(user.id), "email": user.email, "action": "register", "provider": "password"},
                user_id=str(user.id),
                source="auth",
            )
        )
    except Exception:
        logger.warning("Event bus emit failed during registration for user_id=%s", user.id)

    return {
        "token": token,
        "message": "Registration successful",
        "is_new_user": True,
        "user": {
            "id": str(user.id),
            "email": user.email,
            "username": user.username,
            "full_name": user.full_name,
            "phone": user.phone,
            "role": user.role,
            "virtual_capital": float(user.virtual_capital),
            "avatar_url": user.avatar_url,
            "is_verified": user.is_verified,
            "auth_provider": user.auth_provider,
            "account_status": getattr(user, "account_status", "pending_approval"),
        },
    }


# --- Compatibility Routes ---

@router.post("/sync")
async def sync_user(
    req: SyncRequest,
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
):
    """
    Compatibility endpoint (was Firebase sync). With JWT auth, just return current user.
    """
    user = await get_current_user(request, credentials, db)

    return {
        "message": "Login successful",
        "is_new_user": False,
        "assigned_group": None,
        "user": {
            "id": str(user.id),
            "email": user.email,
            "username": user.username,
            "full_name": user.full_name,
            "phone": user.phone,
            "role": user.role,
            "virtual_capital": float(user.virtual_capital),
            "avatar_url": user.avatar_url,
            "is_verified": user.is_verified,
            "auth_provider": user.auth_provider,
            "account_status": getattr(user, "account_status", "active"),
        },
    }


def _normalise_phone(raw: str):
    """Validate and normalise Indian mobile number → '+91XXXXXXXXXX' or None."""
    digits = re.sub(r"[\s\-\(\)]", "", raw.strip())
    if digits.startswith("+91"):
        digits = digits[3:]
    elif digits.startswith("91") and len(digits) == 12:
        digits = digits[2:]
    if not re.fullmatch(r"[6-9]\d{9}", digits):
        return None
    return f"+91{digits}"


@router.post("/set-phone")
async def set_phone(
    req: PhoneSubmitRequest,
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
):
    """
    Save the user's Indian mobile number as contact info.
    """
    user = await get_current_user(request, credentials, db)

    normalised = _normalise_phone(req.phone)
    if not normalised:
        raise HTTPException(
            status_code=400,
            detail="Please enter a valid 10-digit Indian mobile number (starts with 6–9).",
        )

    user.phone = normalised
    user.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)

    logger.info("Phone saved for %s → %s", user.email, normalised)
    return {"message": "Mobile number saved.", "phone": user.phone}


@router.get("/me")
async def get_me(user: User = Depends(get_current_user)):
    """Return current user profile."""
    return {
        "id": str(user.id),
        "email": user.email,
        "username": user.username,
        "full_name": user.full_name,
        "phone": user.phone,
        "role": user.role,
        "virtual_capital": float(user.virtual_capital),
        "avatar_url": user.avatar_url,
        "is_verified": user.is_verified,
        "auth_provider": user.auth_provider,
        "account_status": getattr(user, "account_status", "active"),
        "access_expires_at": (
            user.access_expires_at.isoformat()
            if getattr(user, "access_expires_at", None)
            else None
        ),
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


@router.post("/logout")
async def logout(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    """
    Server-side logout acknowledgment.
    The actual sign-out happens on the client (remove token from localStorage).
    """
    user_id = None
    if credentials:
        payload = decode_token(credentials.credentials)
        if payload:
            user_id = payload.get("sub")

    if user_id:
        event_bus.emit_nowait(
            Event(
                type=EventType.USER_LOGOUT,
                data={"user_id": user_id},
                user_id=user_id,
                source="auth",
            )
        )

    return {"message": "Logged out successfully"}


@router.delete("/delete-account")
async def delete_own_account(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Soft-delete the authenticated user account (keep DB row/data for admin review).
    """
    snapshot = {
        "user_id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "auth_provider": user.auth_provider,
        "deleted_by_user": True,
        "deleted_at": datetime.now(timezone.utc).isoformat(),
    }

    # Stub — Firebase account deletion is a no-op in JWT mode
    firebase_delete = try_delete_firebase_account(getattr(user, "firebase_uid", None))

    user.account_status = "deleted"
    user.is_active = False
    user.deactivation_reason = "Self-deleted by user"
    user.updated_at = datetime.now(timezone.utc)

    db.add(
        AdminAuditLog(
            admin_user_id=None,
            action="self_delete_account",
            target_user_id=user.id,
            details={
                **snapshot,
                "firebase_delete": firebase_delete,
            },
            ip_address=None,
        )
    )

    try:
        event_bus.emit_nowait(
            Event(
                type=EventType.USER_LOGOUT,
                data={
                    "user_id": str(user.id),
                    "self_deleted": True,
                    "email": user.email,
                },
                user_id=str(user.id),
                source="auth",
            )
        )
    except Exception:
        logger.exception("Failed to emit logout event for self-deleted account: %s", user.email)

    await db.commit()
    logger.info("User self-deleted account: %s", user.email)
    return {
        "success": True,
        "message": "Your account has been deleted and access is blocked.",
        "firebase_deleted": firebase_delete.get("deleted", False),
    }
