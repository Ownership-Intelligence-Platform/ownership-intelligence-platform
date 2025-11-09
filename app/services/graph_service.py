"""Compatibility facade for the split graph services.

This module now re-exports the functions from the structured package
`app.services.graph` so existing imports keep working:

    from app.services.graph_service import create_entity, get_layers, ...

New code may import from `app.services.graph` directly.
"""

# Re-export everything from the package
from app.services.graph import *  # noqa: F401,F403

# Optionally expose __all__ for static analyzers
from app.services.graph import __all__  # type: ignore
