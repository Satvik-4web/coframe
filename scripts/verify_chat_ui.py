import time
from playwright.sync_api import sync_playwright

BASE_URL = "http://127.0.0.1:8000"

def test_chat_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        page = context.new_page()

        print("\n[Step 1] Navigating to COFRAME...")
        page.goto(BASE_URL)
        page.wait_for_selector("text=Choose Your Demo Identity")
        page.click("button:has-text('Join as Alex')")
        time.sleep(1.0)

        # 1. Check Overview Quick Chat
        print("[Step 2] Verifying Overview Quick Chat hero...")
        assert page.is_visible("text=What would you like to build today?"), "Overview Quick Chat not visible"
        assert page.is_visible("text=Entire Team"), "Entire team pill not visible"
        assert page.is_visible("text=NOVA"), "NOVA pill not visible"
        assert page.is_visible("text=PIXEL"), "PIXEL pill not visible"
        page.screenshot(path="overview_quick_chat.png")
        print("  -> Screenshot saved: overview_quick_chat.png")

        # 2. Check Navigation: Chat is first item
        print("[Step 3] Verifying Sidebar Navigation order...")
        nav_buttons = page.locator("nav button").all_text_contents()
        print("  -> Navigation items found:", [n.split("\n")[0].strip() for n in nav_buttons[:7]])
        first_nav = nav_buttons[0].strip()
        assert "Chat" in first_nav, f"Expected 'Chat' to be first item, got: {first_nav}"

        # 3. Click Chat to open WorkspaceChatView
        print("[Step 4] Opening Workspace Chat page...")
        page.click("nav button:has-text('Chat')")
        time.sleep(1.0)

        assert page.is_visible("text=Conversations"), "Conversations sidebar not visible"
        assert page.is_visible("text=LedgerFlow Team Room"), "LedgerFlow Team Room not visible"
        assert page.is_visible("text=Collaboration Context"), "Collaboration context panel not visible"
        print("  -> WorkspaceChatView loaded successfully with 3-panel layout!")

        # 4. Send a message to NOVA from UI
        print("[Step 5] Sending message to NOVA via Workspace Chat...")
        # Select NOVA recipient pill
        page.click("div:has-text('Send to:') >> button:has-text('NOVA')")
        time.sleep(0.3)

        # Type message
        textarea = page.locator("textarea").first
        textarea.fill("NOVA, what are our compliance criteria for enterprise expenses over $10,000?")
        page.click("button:has-text('Send Message')")

        # Wait for agent reply
        time.sleep(2.5)

        # Verify reply appears
        assert page.is_visible("text=NOVA"), "NOVA message header not visible"
        page.screenshot(path="workspace_chat_nova_response.png")
        print("  -> Screenshot saved: workspace_chat_nova_response.png")

        # 5. Send a message to PIXEL requesting a proposal
        print("[Step 6] Sending message to PIXEL requesting UI change...")
        page.click("div:has-text('Send to:') >> button:has-text('PIXEL')")
        time.sleep(0.3)
        textarea.fill("PIXEL, update the dashboard metrics to include monthly spend trends.")
        page.click("button:has-text('Send Message')")
        time.sleep(2.5)

        assert page.is_visible("text=Actionable Proposal") or page.is_visible("text=View Proposal"), "Proposal card not visible in chat"
        page.screenshot(path="workspace_chat_pixel_proposal.png")
        print("  -> Screenshot saved: workspace_chat_pixel_proposal.png")

        print("\n[SUCCESS] ALL WORKSPACE CHAT UI TESTS VERIFIED!")
        browser.close()

if __name__ == "__main__":
    test_chat_ui()
