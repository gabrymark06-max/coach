from __future__ import annotations

import uuid
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    email_verified: bool


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128, description="Almeno 10 caratteri")
    accept_terms: Literal[True] = Field(description="Deve essere true: accettazione di Termini e Privacy")

    @field_validator("email")
    @classmethod
    def _lower(cls, v: str) -> str:
        return v.strip().lower()


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

    @field_validator("email")
    @classmethod
    def _lower(cls, v: str) -> str:
        return v.strip().lower()


class TokenPairOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int = Field(description="Secondi di validità dell'access token")
    user: UserOut


class RefreshIn(BaseModel):
    refresh_token: str = Field(min_length=10, max_length=256)


class LogoutIn(BaseModel):
    refresh_token: str = Field(min_length=10, max_length=256)


class VerifyIn(BaseModel):
    token: str = Field(min_length=10, max_length=256)


class ForgotIn(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def _lower(cls, v: str) -> str:
        return v.strip().lower()


class ResetIn(BaseModel):
    token: str = Field(min_length=10, max_length=256)
    password: str = Field(min_length=10, max_length=128)


class AcceptedOut(BaseModel):
    accepted: Literal[True] = True
    detail: str
