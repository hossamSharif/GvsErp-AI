"""Pytest bootstrap for apps/ai tests.

Ensures the ``src`` package resolves the same way it does at runtime
(``uv run streamlit run app.py`` adds the app dir to sys.path implicitly;
pytest needs us to do it).
"""

from __future__ import annotations

import sys
from pathlib import Path

APPS_AI = Path(__file__).resolve().parent.parent
if str(APPS_AI) not in sys.path:
    sys.path.insert(0, str(APPS_AI))
