"""
conftest.py - cau hinh chung cho pytest (SV: 23130141 - Nguyen Tuan Kha)
- Dat kich thuoc cua so, ngon ngu.
- Khi test FAIL: tu chup anh man hinh, luu vao thu muc screenshots/ va nhung vao bao cao HTML.
"""
import base64
import os

import pytest

SHOT_DIR = "screenshots"


@pytest.fixture(scope="session")
def browser_context_args(browser_context_args):
    return {**browser_context_args, "viewport": {"width": 1600, "height": 900}, "locale": "en-US"}


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_makereport(item, call):
    outcome = yield
    report = outcome.get_result()
    if report.when != "call" or not report.failed:
        return
    page = item.funcargs.get("admin_page") or item.funcargs.get("page")
    if page is None:
        return
    try:
        png = page.screenshot()
    except Exception:  # noqa: BLE001
        return
    os.makedirs(SHOT_DIR, exist_ok=True)
    safe = item.name.replace("[", "_").replace("]", "").replace("/", "_")
    with open(os.path.join(SHOT_DIR, f"{safe}.png"), "wb") as fh:
        fh.write(png)
    try:
        from pytest_html import extras

        report.extras = getattr(report, "extras", []) + [
            extras.png(base64.b64encode(png).decode("ascii"), name="Screenshot khi loi")
        ]
    except Exception:  # noqa: BLE001
        pass
