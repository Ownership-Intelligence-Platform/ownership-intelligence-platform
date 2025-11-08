import os
from typing import Optional

try:
    from neo4j import GraphDatabase
except Exception as _import_exc:
    GraphDatabase = None
    _neo4j_import_exc = _import_exc

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
        uri, user, pwd = _get_neo4j_config()
        try:
            _driver = GraphDatabase.driver(uri, auth=(user, pwd))
        except Exception as exc:
            raise RuntimeError(
                f"Failed to create Neo4j driver for URI '{uri}'. Check that the database is running and the credentials are correct.\nError: {exc}"
            ) from exc
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


def _load_env_from_file():
    """Load environment variables from a .env file at the project root if present.

    Only sets variables that aren't already present in the process environment.
    Avoids an external dependency on python-dotenv for this small use case.
    """
    try:
        root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
        env_path = os.path.join(root_dir, ".env")
        if not os.path.isfile(env_path):
            return
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                s = line.strip()
                if not s or s.startswith("#"):
                    continue
                if "=" not in s:
                    continue
                key, val = s.split("=", 1)
                key = key.strip()
                val = val.strip().strip('"').strip("'")
                # Allow space around '=' like KEY = value
                if key and (key not in os.environ or not os.environ[key]):
                    os.environ[key] = val
    except Exception:
        # Silent fail; loading .env is best-effort
        pass


def _get_neo4j_config():
    """Get Neo4j URI, user, and password, loading .env if necessary and applying defaults.

    Returns (uri, user, password). Raises a helpful RuntimeError when required values are missing.
    """
    # Try to load from .env if not already set
    _load_env_from_file()

    uri = os.getenv("NEO4J_URI") or "bolt://localhost:7687"
    user = os.getenv("NEO4J_USER") or "neo4j"
    pwd = os.getenv("NEO4J_PASSWORD")

    missing = []
    if not uri:
        missing.append("NEO4J_URI")
    if not user:
        missing.append("NEO4J_USER")
    if not pwd:
        missing.append("NEO4J_PASSWORD")

    if missing:
        hint = (
            "One or more Neo4j settings are missing: " + ", ".join(missing) +
            "\nDefine them in your environment or in a .env file at the project root.\n" \
            "PowerShell example:\n" \
            "$env:NEO4J_URI='bolt://localhost:7687'; $env:NEO4J_USER='neo4j'; $env:NEO4J_PASSWORD='your_password'"
        )
        raise RuntimeError(hint)

    return uri, user, pwd
