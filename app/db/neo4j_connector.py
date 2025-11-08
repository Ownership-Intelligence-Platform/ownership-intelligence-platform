import os
from typing import Optional

try:
    from neo4j import GraphDatabase
except Exception as _import_exc:
    GraphDatabase = None
    _neo4j_import_exc = _import_exc

NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USER = os.getenv("NEO4J_USER")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

_driver = None


def _ensure_neo4j_available():
    if GraphDatabase is None:
        # Raise a clear error that tells the user how to fix it
        raise RuntimeError(
            "The 'neo4j' Python package is not installed.\n"
            "Install dependencies with: pip install -r requirements.txt\n"
            "Or install just the driver: pip install neo4j\n"
            f"Import error: {_neo4j_import_exc!r}"
        )


def get_driver():
    """Return a Neo4j driver instance, raising a helpful error if the driver isn't installed."""
    global _driver
    _ensure_neo4j_available()
    if _driver is None:
        _driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    return _driver


def close_driver():
    global _driver
    if _driver is not None:
        _driver.close()
        _driver = None


def run_cypher(query: str, parameters: dict = None):
    """Run a Cypher statement and return list of records as dicts.

    This function will raise a RuntimeError with an actionable message if the
    Neo4j Python driver isn't installed in the current environment.
    """
    driver = get_driver()
    with driver.session() as session:
        result = session.run(query, parameters or {})
        return [record.data() for record in result]
