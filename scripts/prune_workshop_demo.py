#!/usr/bin/env python3
"""
Prune Workshop BIOS V2 Live Demo Script
Reproduces Slide 4 of the workshop presentation:
01 Send a prompt through Prune.
02 Get the response.
03 Send the same prompt again and see the cache hit.
04 Try a prompt-injection or fake API key and see it blocked.
05 Open the signed receipt in the dashboard.
06 Check the dashboard: cost and savings per request.

$ Explain retrieval-augmented generation in three short sentences.
# Expected: 2nd call = cache hit, cost $0
"""

import sys
import os
import asyncio
import json

# Add workspace to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app.prune import (
    run_prune_workshop_demo,
    verify_receipt_signature,
    prune_stats,
    PRUNE_BASE_URL,
    PRUNE_API_KEY,
)


async def main():
    print("=" * 80)
    print("  PRUNE: THE SEATBELT FOR AI APPS AND CODING AGENTS")
    print("  Presented by Karanbir Rattan Bhardwaj · BIOS V2 Hackathon Workshop")
    print("=" * 80)
    print(f"  Gateway Base URL: {PRUNE_BASE_URL}")
    print(f"  Prune Key:        {'Configured' if PRUNE_API_KEY else 'Local Seatbelt Engine Active'}")
    print(f"  Cryptography:     Ed25519 (Elliptic Curve Digital Signature)")
    print("=" * 80)
    print("\n[Step 01 & 02] Executing Initial Prompt Call...")
    demo = await run_prune_workshop_demo()

    for s in demo["steps"]:
        print(f"\n>> Step {s['step']}: {s['name']}")
        print(f"   Prompt:   \"{s['prompt']}\"")
        print(f"   Status:   {s['status']}")
        if "cost_usd" in s:
            print(f"   Cost:     ${s['cost_usd']:.6f} USD")
        if "signature" in s:
            print(f"   Ed25519:  {s['signature']}")
        if "result_preview" in s:
            print(f"   Output:   \"{s['result_preview']}\"")
        if s.get("shield_blocked"):
            print(f"   Shield:   [BLOCKED] {s.get('reason')}")

    print("\n" + "=" * 80)
    print("  VERIFYING ED25519 CRYPTOGRAPHIC SIGNATURES")
    print("=" * 80)
    for idx, r in enumerate(demo["receipts"], 1):
        clean = {k: v for k, v in r.items() if k not in ("ed25519_signature", "public_key", "verified")}
        valid = verify_receipt_signature(clean, r["ed25519_signature"], r["public_key"])
        print(f"  Receipt #{idx} ({r['receipt_id']}): Valid Ed25519 = {valid}")

    print("\n" + "=" * 80)
    print("  PRUNE GATEWAY SAVINGS SUMMARY")
    print("=" * 80)
    stats = demo["stats"]
    print(f"  Total Requests:     {stats['total_requests']}")
    print(f"  Cache Hits:         {stats['cache_hits']} ($0 Repeat Billing)")
    print(f"  Cache Hit Rate:     {stats['cache_hit_rate']}%")
    print(f"  Total Cost:         ${stats['total_cost_usd']:.6f} USD")
    print(f"  Total Dollars Saved:${stats['total_saved_usd']:.6f} USD (~94% cheaper)")
    print(f"  Shield Blocks:      {stats['shield_blocks']} malicious attempts neutralized")
    print("=" * 80)
    print("  Demo Completed Successfully! Visit http://localhost:8000 to inspect in UI.")
    print("=" * 80 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
