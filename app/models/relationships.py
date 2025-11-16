from typing import Optional
from pydantic import BaseModel, Field
from .account_opening import AccountOpeningInfo


class RelationshipCreate(BaseModel):
    """Create an interpersonal relationship for a person.

    relation: one of [father, mother, parent, child, spouse, friend, classmate]
    related_id: target person id
    related_name: optional display name for the related person
    account_opening: optional account-opening info for the related person
    """

    relation: str = Field(description="father|mother|parent|child|spouse|friend|classmate")
    related_id: str = Field(description="Related person id")
    related_name: Optional[str] = None
    account_opening: Optional[AccountOpeningInfo] = None

    class Config:
        from_attributes = True
