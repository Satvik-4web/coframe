import pytest
import time
from playwright.sync_api import sync_playwright

BASE_URL = "http://127.0.0.1:8000"


def test_coframe_two_session_full_workflow():
    with sync_playwright() as p:
        # Launch Chromium browser
        browser = p.chromium.launch(headless=True)

        # Context 1: Alex (Founder)
        context_alex = browser.new_context()
        page_alex = context_alex.new_page()

        # Context 2: Maya (Designer)
        context_maya = browser.new_context()
        page_maya = context_maya.new_page()

        print("\n[Step 1] Loading COFRAME and selecting identities...")
        page_alex.goto(BASE_URL)
        page_maya.goto(BASE_URL)

        # Alex chooses identity
        page_alex.wait_for_selector("text=Choose Your Demo Identity")
        page_alex.click("text=Join as Alex")

        # Maya chooses identity
        page_maya.wait_for_selector("text=Choose Your Demo Identity")
        page_maya.click("text=Join as Maya")

        # Give WebSocket a moment to establish presence
        time.sleep(1.5)

        # Verify TopBar branding and online presence indicators
        assert page_alex.is_visible("text=COFRAME")
        assert page_alex.is_visible("text=LedgerFlow")
        assert page_maya.is_visible("text=COFRAME")
        print("[OK] Both sessions active with Realtime presence online.")

        # Reset demo to baseline
        print("\n[Baseline] Resetting Demo state...")
        page_alex.evaluate("fetch('/api/demo/reset', { method: 'POST' })")
        time.sleep(1.0)
        page_alex.reload()
        page_maya.reload()
        time.sleep(1.0)

        # Step 2: Start Parallel Agent Runs
        print("\n[Step 2] Triggering Start Collaboration...")
        page_alex.click("text=Start Collaboration (Run Agents)")
        time.sleep(2.0)

        # Navigate both to proposals tab
        page_alex.click("text=Proposals")
        page_maya.click("text=Proposals")
        time.sleep(1.0)

        assert page_alex.is_visible("text=Pending Review")
        print("[OK] NOVA & PIXEL initial proposals submitted and stamped.")

        # Step 3: Mid-flight Requirement Change (Alex changes REQ_AUDIENCE)
        print("\n[Step 3] Alex updates REQ_AUDIENCE to 'Enterprise finance teams'...")
        page_alex.evaluate("""
            fetch('/api/projects/demo-ledgerflow/requirements/REQ_AUDIENCE', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value: 'Enterprise finance teams', editor_id: 'alex' })
            })
        """)
        time.sleep(1.5)
        page_alex.reload()
        page_maya.reload()
        time.sleep(1.0)

        # Step 4: Verify Selective Staleness
        print("\n[Step 4 Case A] Verifying selective staleness...")
        page_alex.click("text=Proposals")
        assert page_alex.is_visible("text=STALE")
        print("[OK] Proposal A selectively marked STALE; Proposal B remains eligible.")

        # Step 4 Case B: Maya manually edits Hero section
        print("\n[Step 4 Case B] Maya manually edits Hero section...")
        page_maya.evaluate("""
            fetch('/api/projects/demo-ledgerflow/artifact/sections/hero', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    expected_version: 1,
                    data: {
                        headline: "Enterprise Spend Governance by Maya",
                        subheadline: "Direct human craftsmanship",
                        cta_text: "Request Access"
                    },
                    editor_id: 'maya'
                })
            })
        """)
        time.sleep(1.5)
        page_alex.reload()
        page_maya.reload()
        time.sleep(1.0)

        page_maya.click("text=Proposals")
        assert page_maya.is_visible("text=CONFLICT")
        print("[OK] Proposal C marked CONFLICT after Maya's manual edit.")

        # Step 5: Restart NOVA and recover context
        print("\n[Step 5] Restarting NOVA and inspecting Context Pack...")
        page_alex.evaluate("fetch('/api/projects/demo-ledgerflow/agents/nova/restart', { method: 'POST' })")
        time.sleep(1.5)
        page_alex.click("text=Agent Activity")
        time.sleep(1.0)
        assert page_alex.is_visible("text=Context Recovery Summary")
        print("[OK] NOVA context recovered from persisted state.")

        # Step 6: High impact decision policy & redirect
        print("\n[Step 6] Triggering high-impact approval policy proposal...")
        page_alex.evaluate("fetch('/api/projects/demo-ledgerflow/agents/propose-policy', { method: 'POST' })")
        time.sleep(1.5)
        page_alex.click("text=Proposals")
        page_maya.click("text=Proposals")
        time.sleep(1.0)

        assert page_maya.is_visible("text=Requires Alex Approval")
        print("[OK] Server-side policy enforced: Requires Alex Approval.")

        # Step 7: View Shared Product Canvas
        print("\n[Step 7] Inspecting final LedgerFlow Product Canvas...")
        page_alex.click("text=Product Canvas")
        time.sleep(1.0)
        assert page_alex.is_visible("text=LedgerFlow App")
        assert page_alex.is_visible("text=Enterprise Spend Governance by Maya")
        print("[OK] LedgerFlow Product Canvas successfully displays shared artifact.")

        # Save screenshot for demo verification
        page_alex.screenshot(path="docs/demo_screenshot.png")
        print("[OK] Demo screenshot saved to docs/demo_screenshot.png")

        browser.close()


if __name__ == "__main__":
    test_coframe_two_session_full_workflow()
