"""Google OAuth 2.0 (authorization-code flow). The client secret is only used here, on the server."""
from typing import Dict
from urllib.parse import urlencode

import requests

from backend import config

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"


class GoogleAuthError(Exception):
    pass


def is_configured() -> bool:
    return bool(config.GOOGLE_CLIENT_ID and config.GOOGLE_CLIENT_SECRET and config.GOOGLE_REDIRECT_URI)


def build_authorization_url(state: str) -> str:
    params = {"client_id": config.GOOGLE_CLIENT_ID, "redirect_uri": config.GOOGLE_REDIRECT_URI,
              "response_type": "code", "scope": "openid email profile", "state": state,
              "prompt": "select_account"}
    return f"{AUTH_URL}?{urlencode(params)}"


def fetch_user_info(code: str) -> Dict:
    """Exchange the one-time code for the user's Google profile. Raises GoogleAuthError on any problem."""
    try:
        token = requests.post(TOKEN_URL, timeout=10, data={
            "grant_type": "authorization_code", "code": code, "redirect_uri": config.GOOGLE_REDIRECT_URI,
            "client_id": config.GOOGLE_CLIENT_ID, "client_secret": config.GOOGLE_CLIENT_SECRET})
        if token.status_code != 200:
            raise GoogleAuthError("Google rejected the sign-in code.")
        access_token = token.json().get("access_token")
        if not access_token:
            raise GoogleAuthError("Google did not return an access token.")
        info = requests.get(USERINFO_URL, timeout=10, headers={"Authorization": f"Bearer {access_token}"})
        if info.status_code != 200:
            raise GoogleAuthError("Could not read the Google profile.")
        data = info.json()
    except requests.RequestException as exc:
        raise GoogleAuthError("Could not reach Google.") from exc
    except ValueError as exc:
        raise GoogleAuthError("Google returned an unreadable response.") from exc
    if not data.get("sub") or not data.get("email"):
        raise GoogleAuthError("Google profile is missing required fields.")
    if data.get("email_verified") is not True:
        raise GoogleAuthError("The Google e-mail address is not verified.")
    return {"sub": str(data["sub"]), "email": data["email"].strip().lower(),
            "name": (data.get("name") or data["email"].split("@")[0])[:100]}
