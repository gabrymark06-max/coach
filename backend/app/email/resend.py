from __future__ import annotations

import httpx

from app.email.base import OutgoingEmail


class ResendMailer:
    def __init__(self, api_key: str, sender: str) -> None:
        self._api_key = api_key
        self._from = sender

    async def send(self, email: OutgoingEmail) -> str | None:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                "https://api.resend.com/emails",
                headers={"Authorization": f"Bearer {self._api_key}"},
                json={"from": self._from, "to": [email.to], "subject": email.subject, "text": email.text},
            )
            r.raise_for_status()
            return r.json().get("id")
