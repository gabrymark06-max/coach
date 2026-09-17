from __future__ import annotations

from app.config import Settings
from app.email.base import Mailer, OutgoingEmail
from app.email.fake import FakeMailer
from app.email.resend import ResendMailer

__all__ = ["Mailer", "OutgoingEmail", "FakeMailer", "ResendMailer", "build_mailer"]


def build_mailer(settings: Settings) -> Mailer:
    if settings.email_provider == "resend" and settings.resend_api_key:
        return ResendMailer(settings.resend_api_key, settings.email_from)
    return FakeMailer()
