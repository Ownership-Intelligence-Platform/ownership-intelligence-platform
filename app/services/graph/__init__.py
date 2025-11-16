"""Graph domain service package.

Split from monolithic graph_service.py to clearer focused modules.
All functions continue to be imported at package level for backward compatibility.
"""
from .entities import (
    create_entity,
    get_entity,
    find_entities_by_name_exact,
    search_entities_fuzzy,
    resolve_entity_identifier,
)
from .ownerships import create_ownership
from .layers import get_layers
from .penetration import (
    get_equity_penetration,
    get_equity_penetration_with_paths,
)
from .admin import clear_database
from .legal import (
    create_legal_rep,
    get_representatives,
    create_person,
    create_company,
)
from .accounts import create_account, get_accounts
from .locations import create_location_links, get_locations
from .transactions import create_transaction, get_transactions
from .guarantees import create_guarantee, get_guarantees
from .supply_chain import create_supply_link, get_supply_chain
from .employment import create_employment, get_employment
from .news import create_news_item, get_stored_news
from .person_network import get_person_network
from .person_info import set_person_account_opening, get_person_account_opening
from .relationships import create_person_relationship

__all__ = [
    # entities
    'create_entity','get_entity','find_entities_by_name_exact','search_entities_fuzzy','resolve_entity_identifier',
    # ownership
    'create_ownership',
    # layers
    'get_layers',
    # penetration
    'get_equity_penetration','get_equity_penetration_with_paths',
    # admin
    'clear_database',
    # legal & reps
    'create_legal_rep','get_representatives','create_person','create_company',
    # accounts
    'create_account','get_accounts',
    # locations
    'create_location_links','get_locations',
    # transactions
    'create_transaction','get_transactions',
    # guarantees
    'create_guarantee','get_guarantees',
    # supply chain
    'create_supply_link','get_supply_chain',
    # employment
    'create_employment','get_employment',
    # news
    'create_news_item','get_stored_news',
    # person network
    'get_person_network',
    # person info
    'set_person_account_opening','get_person_account_opening',
    # interpersonal relationships
    'create_person_relationship',
]
