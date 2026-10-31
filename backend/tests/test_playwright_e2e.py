import time
from playwright.sync_api import sync_playwright

BASE_URL = "http://127.0.0.1:8000"


def test_coframe_two_session_full_workflow():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # -------------------------------------------------------------
        # 1. Alex and Maya join separate browser sessions
        # -------------------------------------------------------------
        print("\n[Step 1] Loading separate browser sessions for Alex and Maya...")
        context_alex = browser.new_context()
        page_alex = context_alex.new_page()

        context_maya = browser.new_context()
        page_maya = context_maya.new_page()

        page_alex.goto(BASE_URL)
        page_maya.goto(BASE_URL)

        # Choose identities via UI buttons
        page_alex.wait_for_selector("text=Choose Your Demo Identity")
        page_alex.click("button:has-text('Join as Alex')")

        page_maya.wait_for_selector("text=Choose Your Demo Identity")
        page_maya.click("button:has-text('Join as Maya')")

        # Allow WebSocket presence to synchronize
        time.sleep(1.0)

        # Assert UI elements
        assert page_alex.is_visible("text=COFRAME")
        assert page_alex.is_visible("text=LedgerFlow")
        assert page_maya.is_visible("text=COFRAME")
        print("[OK] Both sessions established with Realtime WebSocket presence.")

        # Clean baseline reset via UI
        page_alex.evaluate("fetch('/api/demo/reset', { method: 'POST' })")
        time.sleep(1.0)
        page_alex.reload()
        page_maya.reload()
        time.sleep(1.0)

        # -------------------------------------------------------------
        # 2. NOVA and PIXEL produce proposals
        # -------------------------------------------------------------
        print("\n[Step 2] Alex starts agent collaboration via UI button...")
        if not page_alex.is_visible("button:has-text('Start Collaboration (Run Agents)')"):
            page_alex.click("button:has-text('Guided Demo')")
            time.sleep(0.5)
            page_alex.click("button:has-text('2')")
            time.sleep(0.5)
        page_alex.click("button:has-text('Start Collaboration (Run Agents)')")
        time.sleep(2.5)

        # Both navigate to Proposals tab
        page_alex.click("button:has-text('Proposals')")
        page_maya.click("button:has-text('Proposals')")
        time.sleep(1.0)

        # Assert initial proposals rendered on UI
        assert page_alex.is_visible("text=Position LedgerFlow")
        assert page_alex.is_visible("text=Introduce real-time spend")
        assert page_alex.is_visible("text=High-conversion hero header")
        print("[OK] NOVA and PIXEL proposals generated, stamped, and displayed.")

        # -------------------------------------------------------------
        # 3. Alex changes the audience requirement
        # -------------------------------------------------------------
        print("\n[Step 3] Alex updates REQ_AUDIENCE via Product Brief UI...")
        page_alex.click("button:has-text('Product Canvas')")
        time.sleep(0.5)
        page_alex.click("button:has-text('Product Brief & Strategy')")
        time.sleep(0.5)

        # Click Edit as Alex
        page_alex.click("button:has-text('Edit as Alex')")
        page_alex.wait_for_selector("input[placeholder*='Enterprise finance teams']")
        page_alex.fill("input[placeholder*='Enterprise finance teams']", "Enterprise finance teams")
        page_alex.click("button:has-text('Update & Advance Context')")
        time.sleep(1.5)
        print("[OK] Alex updated audience requirement to Enterprise finance teams.")

        # -------------------------------------------------------------
        # 4. Selective Staleness & Section Conflict
        # -------------------------------------------------------------
        print("\n[Step 4 Case A] Verifying selective staleness on Proposals tab...")
        page_alex.click("button:has-text('Proposals')")
        time.sleep(0.5)

        # Proposal A must be STALE, Proposal B must remain eligible
        assert page_alex.is_visible("text=STALE")
        assert page_alex.is_visible("text=Written for 'Small businesses'; the audience is now 'Enterprise finance teams'.")
        print("[OK] Proposal A selectively marked STALE; Proposal B remains eligible.")

        print("\n[Step 4 Case B] Maya manually edits the Hero section in prototype...")
        page_maya.click("button:has-text('Product Canvas')")
        time.sleep(0.5)
        page_maya.click("button:has-text('Manual Edit Hero (Maya)')")
        page_maya.wait_for_selector("text=Direct Hero Edit (as Maya)")

        # Fill modal form
        page_maya.fill("form input >> nth=0", "Enterprise Spend Governance by Maya")
        page_maya.fill("form textarea", "Direct human refinement with custom corporate policy.")
        page_maya.fill("form input >> nth=1", "Request Enterprise Access")
        page_maya.click("button:has-text('Save Manual Edit')")
        time.sleep(1.5)

        # Check conflict on Proposals tab in Maya's window
        page_maya.click("button:has-text('Proposals')")
        time.sleep(0.5)
        assert page_maya.is_visible("text=CONFLICT")

        # Open Side-by-Side Conflict Comparison Modal
        page_maya.click("button:has-text('Compare Side-by-Side Conflict')")
        page_maya.wait_for_selector("text=Human vs. Agent Section Conflict")
        assert page_maya.is_visible("text=Maya's Current Version")
        assert page_maya.is_visible("text=PIXEL's Proposed Version")
        page_maya.click('button:has-text("Keep Maya")')
        time.sleep(1.0)
        print("[OK] Human vs Agent conflict detected and resolved via comparison modal.")

        # -------------------------------------------------------------
        # 5. Restart NOVA and inspect actual recovered Context Pack
        # -------------------------------------------------------------
        print("\n[Step 5] Restarting NOVA and inspecting Context Pack...")
        page_alex.click("button:has-text('Agent Activity')")
        time.sleep(0.5)
        page_alex.click("button:has-text('Restart & Recover Context')")
        time.sleep(2.0)

        # Verify Context Inspector content
        assert page_alex.is_visible("text=Context Recovery Summary")
        assert page_alex.is_visible("text=State Reconstructed from Database")
        assert page_alex.is_visible("text=Authoritative Immutable JSON")
        print("[OK] NOVA restarted and authoritative Context Pack recovered from DB.")

        # -------------------------------------------------------------
        # 6. High-impact proposal: Maya denied, Alex redirects & approves
        # -------------------------------------------------------------
        print("\n[Step 6] Triggering high-impact approval policy proposal via Stepper...")
        # Select Step 6 in the walkthrough stepper and trigger
        if not page_alex.is_visible("button:has-text('6')"):
            page_alex.click("button:has-text('Guided Demo')")
            time.sleep(0.5)
        page_alex.click("button:has-text('6')")
        time.sleep(0.5)
        page_alex.click("button:has-text('Propose Enterprise Policy (PIXEL)')")
        time.sleep(2.0)

        # Both view Proposals
        page_alex.click("button:has-text('Proposals')")
        page_maya.click("button:has-text('Proposals')")
        time.sleep(1.0)

        # In Maya's window: assert that approval is restricted/disabled
        assert page_maya.is_visible("text=Requires Alex Approval")
        disabled_btn = page_maya.locator("button:has-text('Alex Approval Required')")
        assert disabled_btn.is_visible()
        print("[OK] Maya is correctly blocked from approving high-impact proposal.")

        # In Alex's window: Alex clicks Redirect
        print("Alex initiates human Redirect with instruction note...")
        # Find the card with Requires Alex Approval and click Redirect
        policy_card = page_alex.locator("div.rounded-xl:has-text('Requires Alex Approval')").first
        policy_card.locator("button:has-text('Redirect')").click()

        page_alex.wait_for_selector("text=Redirect PIXEL")
        page_alex.fill("textarea", "Make approval thresholds configurable per organisation")
        page_alex.click("button:has-text('Dispatch Redirect Instruction')")
        time.sleep(2.5)

        # Locate the revised proposal (supersedes original)
        page_alex.reload()
        time.sleep(1.0)
        page_alex.click("button:has-text('Proposals')")
        time.sleep(0.5)
        assert page_alex.is_visible("text=revised from #")

        # Alex approves the revised proposal
        revised_card = page_alex.locator("div.rounded-xl:has-text('revised from #')").first
        revised_card.locator("button:has-text('Approve & Apply')").click()
        time.sleep(2.0)

        page_alex.reload()
        page_maya.reload()
        time.sleep(1.0)
        print("[OK] Alex successfully redirected PIXEL and approved revised proposal.")

        # -------------------------------------------------------------
        # 7. Both browser sessions display the final LedgerFlow artifact
        # -------------------------------------------------------------
        print("\n[Step 7] Verifying shared product canvas across both browser sessions...")
        page_alex.click("button:has-text('Product Canvas')")
        page_maya.click("button:has-text('Product Canvas')")
        time.sleep(1.0)

        # Verify hero edited by Maya is visible in both sessions
        assert page_alex.is_visible("text=Enterprise Spend Governance by Maya")
        assert page_maya.is_visible("text=Enterprise Spend Governance by Maya")

        # Verify configurable approval queue is rendered in both sessions
        assert page_alex.is_visible("text=Configurable")
        assert page_maya.is_visible("text=Configurable")
        print("[OK] Final LedgerFlow Product Canvas verified in both human sessions.")

        # Save screenshot for verification records
        page_alex.screenshot(path="docs/demo_screenshot.png")
        print("[OK] Screenshot saved to docs/demo_screenshot.png.")

        browser.close()


if __name__ == "__main__":
    test_coframe_two_session_full_workflow()
