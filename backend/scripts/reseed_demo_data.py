from __future__ import annotations

import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from scripts.reset_demo_data import RESET_FLAG, reset_demo_data  # noqa: E402
from scripts.seed_demo_data import seed_demo_data  # noqa: E402


def reseed_demo_data() -> None:
    if os.getenv(RESET_FLAG, "").strip().lower() != "true":
        print(f"Demo reseed skipped. Set {RESET_FLAG}=true to delete and recreate local demo data.")
        return

    reset_demo_data()
    seed_demo_data()


if __name__ == "__main__":
    reseed_demo_data()
