import jwt
from fastapi import HTTPException, status
from pydantic import BaseModel

from .config import get_settings


class SessionClaims(BaseModel):
    sid: str
    uid: str
    iat: int
    exp: int


def verify_session_token(token: str, session_id: str) -> SessionClaims:
    """Verify the HS256 JWT minted by the Next.js start route.

    The token is bound to one session id so a candidate can't reuse it to
    drive somebody else's interview.
    """
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.realtime_service_secret,
            algorithms=["HS256"],
            options={"require": ["exp", "iat", "sid", "uid"]},
            # Next.js and this service run on different hosts; a few seconds
            # of clock skew must not reject every token.
            leeway=30,
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Session token expired")
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid session token")

    claims = SessionClaims(**payload)
    if claims.sid != session_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Token is for a different session")
    return claims


def bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    return authorization[7:].strip()
