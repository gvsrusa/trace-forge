"""
Day 2 smoke test — runs a real review on ProductCard.tsx and prints output.
Run: uv run python scripts/test_review.py
Then check app.phoenix.arize.com/s/YOUR_SPACE for the trace.
"""

import asyncio
import sys
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

from instrumentation import setup_tracing

tp = setup_tracing()

PRODUCT_CARD = Path(__file__).parent.parent.parent / "demo/test-components/ProductCard.tsx"


async def main():
    from agent import run_review

    code = PRODUCT_CARD.read_text()
    print(f"Reviewing {PRODUCT_CARD.name} ({len(code)} chars)...\n")

    async for event in run_review(code=code, filename="ProductCard.tsx", language="tsx"):
        kind = event.get("type")
        if kind == "step":
            print(f"  ▶ {event['name']}")
        elif kind == "tool_call":
            status = "→" if event["status"] == "running" else "✓"
            print(f"    {status} {event['tool']}()")
        elif kind == "thought":
            snippet = event["content"][:120].replace("\n", " ")
            print(f"    💭 {snippet}")
        elif kind == "final":
            print("\n" + "═" * 60)
            print("REVIEW OUTPUT:")
            print("═" * 60)
            print(event["content"])
            print("═" * 60)
        elif kind == "error":
            print(f"\n❌ ERROR: {event['message']}", file=sys.stderr)
            sys.exit(1)

    if tp:
        tp.force_flush()
        print("\n✅ Trace flushed to Phoenix Cloud")
        print("   → Check: https://app.phoenix.arize.com/s/YOUR_SPACE")


if __name__ == "__main__":
    asyncio.run(main())
