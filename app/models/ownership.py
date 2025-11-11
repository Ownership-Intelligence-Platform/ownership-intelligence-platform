from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class EntityCreate(BaseModel):
    id: str = Field(..., description="Unique entity id")
    name: Optional[str]
    type: Optional[str]
    description: Optional[str] = Field(None, description="Entity description / notes")


class OwnershipCreate(BaseModel):
    owner_id: str
    owned_id: str
    stake: Optional[float] = Field(None, description="Ownership percentage (0-100)")


class EntityOut(BaseModel):
    id: str
    name: Optional[str]
    type: Optional[str]
    description: Optional[str] = None


class OwnershipOut(BaseModel):
    owner: EntityOut
    owned: EntityOut
    stake: Optional[float]


class LayerNode(BaseModel):
    id: str
    name: Optional[str]
    type: Optional[str]


class LayerResponse(BaseModel):
    root: LayerNode
    layers: List[Dict[str, Any]]


class RepresentativeCreate(BaseModel):
    company_id: str
    person_id: str
    role: Optional[str] = Field(
        default="Corporate Legal Representative",
        description="Role/title of the representative",
    )


# --- Extended graph models (Phase 1) ---

class PersonCreate(BaseModel):
    """Create or update a Person entity.

    We keep extra attributes grouped to stay flexible while the schema evolves.
    """
    id: str = Field(..., description="Unique person id")
    name: Optional[str] = Field(None, description="Person name")
    type: Optional[str] = Field(None, description="Entity type hint, e.g., 'Person'")
    basic_info: Optional[Dict[str, Any]] = Field(
        default=None, description="Basic profile info (age, gender, etc.)"
    )
    id_info: Optional[Dict[str, Any]] = Field(
        default=None, description="Identity identifiers (ID number, passport, etc.)"
    )
    job_info: Optional[Dict[str, Any]] = Field(
        default=None, description="Occupation info (position, employer, sector)"
    )


class CompanyCreate(BaseModel):
    """Create or update a Company entity."""
    id: str = Field(..., description="Unique company id")
    name: Optional[str] = Field(None, description="Company name")
    type: Optional[str] = Field(None, description="Entity type hint, e.g., 'Company'")
    business_info: Optional[Dict[str, Any]] = Field(
        default=None, description="Business registration info"
    )
    status: Optional[str] = Field(
        default=None, description="Operating status (active, dissolved, etc.)"
    )
    industry: Optional[str] = Field(
        default=None, description="Industry classification code/name"
    )


class AccountCreate(BaseModel):
    """Create or update a Bank/Payment account and link it to an owner."""
    owner_id: str = Field(..., description="Owner entity id (person or company)")
    account_number: str = Field(..., description="Account number (unique)")
    bank_name: Optional[str] = Field(None, description="Account opening bank")
    balance: Optional[float] = Field(None, description="Current balance")


class LocationCreate(BaseModel):
    """Create location nodes and link an entity to them via specific relations."""
    entity_id: str = Field(..., description="Entity id to attach locations to")
    registered: Optional[str] = Field(
        default=None, description="Registered location name/code"
    )
    operating: Optional[str] = Field(
        default=None, description="Operating location name/code"
    )
    offshore: Optional[str] = Field(
        default=None, description="Offshore location name/code"
    )


class TransactionCreate(BaseModel):
    """Create a Transaction as a node linked between two entities."""
    from_id: str = Field(..., description="Sender/source entity id")
    to_id: str = Field(..., description="Receiver/target entity id")
    amount: float = Field(..., description="Transaction amount")
    time: Optional[str] = Field(None, description="Timestamp/ISO string")
    tx_type: Optional[str] = Field(None, description="Transaction type")
    channel: Optional[str] = Field(None, description="Channel or method")


class GuaranteeCreate(BaseModel):
    """Create a guarantee relationship between two entities."""
    guarantor_id: str = Field(..., description="Guarantor entity id")
    guaranteed_id: str = Field(..., description="Guaranteed entity id")
    amount: float = Field(..., description="Guaranteed amount")


class SupplyLinkCreate(BaseModel):
    """Create a supply chain relationship from supplier to customer."""
    supplier_id: str = Field(..., description="Supplier entity id")
    customer_id: str = Field(..., description="Customer entity id")
    frequency: Optional[int] = Field(
        default=None, description="Observed transaction frequency"
    )


class EmploymentCreate(BaseModel):
    """Create a general employment/position relation (person -> company)."""
    company_id: str
    person_id: str
    role: Optional[str] = Field(
        default=None, description="Role among {legal rep, director, executive, ...}"
    )
