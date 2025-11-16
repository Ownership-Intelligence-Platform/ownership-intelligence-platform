from typing import Optional
from pydantic import BaseModel, Field


class AccountOpeningInfo(BaseModel):
    """Personal bank account opening info (de-identified).

    Note: Sensitive fields like ID number and account number should be provided in
    raw form by the caller only if necessary; they will be masked before storage.
    Only masked versions are persisted.
    """

    bank_name: Optional[str] = Field(default=None, description="Bank name")
    account_type: Optional[str] = Field(default=None, description="Account type, e.g., Savings/Priority")
    currencies: Optional[str] = Field(default=None, description="Comma-separated currency codes")
    account_number: Optional[str] = Field(default=None, description="Account number (will be masked)")

    # Person profile fields (optional)
    name: Optional[str] = None
    id_no: Optional[str] = Field(default=None, description="ID number (will be masked)")
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    employer: Optional[str] = Field(default=None, description="Company / occupation")

    # Stored masked values (read-only in responses)
    account_number_masked: Optional[str] = None
    id_no_masked: Optional[str] = None

    class Config:
        from_attributes = True
