"""Sends password-reset e-mails through SMTP. Nothing is sent unless SMTP is configured in backend/.env."""
import logging
import smtplib
from email.message import EmailMessage

from backend import config

logger = logging.getLogger("fuelwise.mail")


def smtp_configured() -> bool:
    return bool(config.SMTP_HOST and config.SMTP_FROM)


def send_email(to: str, subject: str, body: str) -> None:
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = config.SMTP_FROM, to, subject
    msg.set_content(body)
    if config.SMTP_PORT == 465:
        server = smtplib.SMTP_SSL(config.SMTP_HOST, config.SMTP_PORT, timeout=15)
    else:
        server = smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=15)
    with server:
        if config.SMTP_PORT != 465 and config.SMTP_USE_TLS:
            server.starttls()
        if config.SMTP_USER:
            server.login(config.SMTP_USER, config.SMTP_PASSWORD)
        server.send_message(msg)


def send_reset_email(to: str, link: str) -> str:
    """Returns "sent", "dev_console" or "not_configured". Never raises (failures are logged)."""
    if smtp_configured():
        try:
            send_email(to, "Reset your FuelWise password",
                       f"Hello,\n\nUse this link to choose a new FuelWise password "
                       f"(valid for {config.RESET_TOKEN_MINUTES} minutes, one use only):\n\n{link}\n\n"
                       "If you did not ask for this, you can ignore this e-mail.\n")
            return "sent"
        except Exception as exc:  # noqa: BLE001 - never leak mail errors to the caller
            logger.error("Could not send reset e-mail: %s", exc)
            return "not_configured"
    if config.DEV_PRINT_RESET_LINKS:
        print(f"\n[FuelWise DEV ONLY] Password reset link for {to}:\n{link}\n")
        return "dev_console"
    logger.warning("Password reset requested but SMTP is not configured and DEV_PRINT_RESET_LINKS is off; nothing sent.")
    return "not_configured"
