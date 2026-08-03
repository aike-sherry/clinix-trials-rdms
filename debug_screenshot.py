from playwright.sync_api import sync_playwright
import time

BASE_URL = "http://127.0.0.1:7300"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel="msedge")
    context = browser.new_context(viewport={"width": 1440, "height": 900})
    page = context.new_page()

    # 监听控制台日志
    logs = []
    page.on("console", lambda msg: logs.append(f"{msg.type}: {msg.text}"))
    page.on("pageerror", lambda err: logs.append(f"ERROR: {err}"))

    page.goto(f"{BASE_URL}/login", timeout=60000)
    page.wait_for_load_state("networkidle")
    time.sleep(2)

    page.evaluate('''() => {
        const data = JSON.parse(localStorage.getItem("clini_x_rdms_data") || "{}");
        data.currentUser = {"id":"user_manager_demo","username":"manager","name":"管理用户","role":"manager","createdAt":"2026-08-01T00:00:00Z","updatedAt":"2026-08-01T00:00:00Z","isActive":true};
        localStorage.setItem("clini_x_rdms_data", JSON.stringify(data));
    }''')

    page.goto(f"{BASE_URL}/manager", timeout=60000)
    page.wait_for_load_state("networkidle")
    time.sleep(5)

    print("=== Console logs:")
    for log in logs[-20:]:
        print(log)

    # 检查root是否有内容
    root = page.query_selector("#root")
    if root:
        print(f"\n=== #root innerHTML length: {len(root.inner_html())}")

    browser.close()
