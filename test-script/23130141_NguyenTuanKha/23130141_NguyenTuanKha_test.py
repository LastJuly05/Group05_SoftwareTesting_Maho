"""
Automation test (Playwright + pytest) - Maho Commerce demo admin
Website   : https://demo.mahocommerce.com (trang Admin)
Chuc nang : Manage Customers (CUS), Catalog Price Rules (CPR), Shopping Cart Price Rules (SCR)
            Moi chuc nang gom: Them (Create), Xem/Tim kiem (Read), Sua (Update), Xoa (Delete)
SV        : 23130141 - Nguyen Tuan Kha (Nhom 5)

Cai dat:
    pip install pytest pytest-playwright pytest-html
    python -m playwright install chromium

Dang nhap admin (KHONG ghi mat khau vao file, KHONG day len GitHub):
    CMD:        set "MAHO_PASSWORD=mat_khau_demo"
                (tuy chon) set "MAHO_USER=demo"
                (tuy chon) set "MAHO_ADMIN_URL=https://demo.mahocommerce.com/admin2941834/"
    PowerShell: $env:MAHO_PASSWORD="mat_khau_demo"

Chay (co bao cao HTML):
    pytest -v --headed --slowmo 300 --html=report.html --self-contained-html

Luu y:
- Moi test tu tao du lieu rieng (ten co ma thoi gian, bat dau bang 'QA') va tu xoa sau khi chay.
- Link trong admin co khoa bi mat thay doi theo phien, nen script di chuyen bang menu, khong dung link co dinh.
- Tab Conditions cua rule de trong (khong dat dieu kien).
"""
import os
import random
import re
import time

import pytest

# ---------------------------------------------------------------- cau hinh
ADMIN_URL = os.getenv("MAHO_ADMIN_URL", "https://demo.mahocommerce.com/admin2941834/")
USER = os.getenv("MAHO_USER", "demo")
PASSWORD = os.getenv("MAHO_PASSWORD")
TIMEOUT = 15000  # ms
WEBSITE = "Maho Store"
GROUPS = ("NOT LOGGED IN", "General")
CPR = "Catalog Price Rules"
SCR = "Shopping Cart Price Rules"
RULE_KINDS = [pytest.param(CPR, id="CPR"), pytest.param(SCR, id="SCR")]

pytestmark = pytest.mark.skipif(not PASSWORD, reason="Chua dat MAHO_PASSWORD")


# ---------------------------------------------------------------- fixture
@pytest.fixture(scope="session")
def auth_state(browser, browser_context_args):
    """Dang nhap admin 1 lan, dung lai phien dang nhap cho moi test."""
    context = browser.new_context(**browser_context_args)
    page = context.new_page()
    page.set_default_timeout(TIMEOUT)
    goto(page, ADMIN_URL)
    page.get_by_label(re.compile("User Name", re.I)).fill(USER)
    page.get_by_label(re.compile("^Password", re.I)).fill(PASSWORD)
    page.get_by_role("button", name=re.compile(r"^Login$", re.I)).click()
    try:
        page.get_by_text("Dashboard", exact=True).locator("visible=true").first.wait_for(timeout=25000)
    except Exception:  # noqa: BLE001
        context.close()
        pytest.fail("Dang nhap admin that bai (kiem tra MAHO_USER, MAHO_PASSWORD, MAHO_ADMIN_URL)")
    state = context.storage_state()
    context.close()
    return state


@pytest.fixture
def admin_page(browser, browser_context_args, auth_state):
    context = browser.new_context(**browser_context_args, storage_state=auth_state)
    page = context.new_page()
    page.set_default_timeout(TIMEOUT)
    page.set_default_navigation_timeout(45000)
    page.on("dialog", lambda dialog: dialog.accept())  # xac nhan hop thoai 'Are you sure?'
    goto(page, ADMIN_URL)
    yield page
    context.close()


@pytest.fixture
def make_customer(admin_page):
    """Tao customer cho test; tu xoa sau khi test xong (ke ca khi test loi)."""
    emails = []

    def _make(**overrides):
        data = new_customer_data()
        data.update(overrides)
        create_customer(admin_page, **data)
        emails.append(data["email"])
        return data

    _make.track = emails.append
    yield _make
    for email in emails:
        try:
            delete_customer(admin_page, email)
        except Exception:  # noqa: BLE001
            pass


@pytest.fixture
def make_rule(admin_page):
    """Tao rule cho test; tu xoa sau khi test xong (ke ca khi test loi)."""
    created = []

    def _make(kind, **overrides):
        data = {"name": new_name("Rule"), "discount": "10"}
        data.update(overrides)
        create_rule(admin_page, kind, **data)
        created.append((kind, data["name"]))
        return data["name"]

    _make.track = lambda kind, name: created.append((kind, name))
    yield _make
    for kind, name in created:
        try:
            delete_rule(admin_page, kind, name)
        except Exception:  # noqa: BLE001
            pass


# ---------------------------------------------------------------- tien ich chung
def check(condition, message):
    if not condition:
        raise AssertionError(message)


def settle(page):
    """Cho trang on dinh; bo qua neu trang co script chay lien tuc."""
    try:
        page.wait_for_load_state("networkidle", timeout=5000)
    except Exception:  # noqa: BLE001
        pass


def goto(page, url):
    """Mo trang; trang demo doi luc cham nen thu lai 1 lan neu qua thoi gian cho."""
    try:
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
    except Exception:  # noqa: BLE001
        page.goto(url, wait_until="domcontentloaded", timeout=45000)
    settle(page)


def uid():
    return time.strftime("%m%d%H%M%S") + str(random.randint(10, 99))


def new_name(prefix):
    return f"QA {prefix} {uid()}"


def new_customer_data():
    u = uid()
    return {"first": f"QA{u}", "last": "Tester", "email": f"qa.{u}@example.com",
            "password": "Qa@12345678"}


def visible(locator):
    return locator.locator("visible=true")


def button(page, name):
    return visible(page.get_by_role("button", name=re.compile(f"^{re.escape(name)}$", re.I))).first


def field(page, label):
    """O nhap/chon theo nhan (label), bo qua dau * o cuoi nhan."""
    return visible(page.get_by_label(re.compile(rf"^{re.escape(label)}\s*\*?\s*$"))).first


def text_visible(page, pattern):
    return visible(page.get_by_text(re.compile(pattern, re.I))).first


def wait_message(page, pattern):
    text_visible(page, pattern).wait_for(timeout=TIMEOUT)


def message_shown(page, pattern, wait=1500):
    page.wait_for_timeout(wait)
    return visible(page.get_by_text(re.compile(pattern, re.I))).count() > 0


def blocked(page, pattern=r"required|valid|characters|already|exist|select|date", tab=None):
    """Form bi chan: co thong bao loi (hoac o nhap khong hop le) va KHONG co thong bao da luu.
    tab: ten tab chua o bi loi (loi nam o tab dang an thi phai mo tab do de thay)."""
    page.wait_for_timeout(1500)
    saved = visible(page.get_by_text(re.compile(r"has been saved", re.I))).count() > 0
    error = visible(page.get_by_text(re.compile(pattern, re.I))).count() > 0
    invalid = visible(page.locator("input:invalid, select:invalid")).count() > 0
    if not (error or invalid) and tab:
        open_tab(page, tab)
        page.wait_for_timeout(500)
        error = visible(page.get_by_text(re.compile(pattern, re.I))).count() > 0
    return (error or invalid) and not saved


def go_menu(page, top, sub):
    """Chon menu tren cung (hover, neu khong mo thi click) roi chon muc con."""
    top_item = visible(page.get_by_text(top, exact=True)).first
    top_item.hover()
    sub_item = visible(page.get_by_text(sub, exact=True)).first
    try:
        sub_item.wait_for(timeout=3000)
    except Exception:  # noqa: BLE001
        top_item.click()
        sub_item.wait_for(timeout=TIMEOUT)
    sub_item.click()
    settle(page)


def open_grid(page, top, sub):
    go_menu(page, top, sub)
    reset = visible(page.get_by_role("button", name=re.compile(r"^Reset Filter$", re.I)))
    if reset.count():
        reset.first.click()
        settle(page)


def grid_search(page, column, value):
    """Loc luoi theo cot (ten o loc = ten cot), bam Enter de tim."""
    box = visible(page.locator(f"input[name='{column}']")).first
    box.fill(value)
    box.press("Enter")
    settle(page)
    page.wait_for_timeout(1500)


def grid_rows(page, text):
    return page.get_by_role("row").filter(has_text=text)


def open_row(page, text):
    """Bam vao dong co chu `text` de mo trang sua."""
    visible(grid_rows(page, text).locator("td").filter(has_text=text)).first.click()
    settle(page)


def confirm_modal(page):
    """Neu trang dung hop thoai tu thiet ke (khong phai hop thoai cua trinh duyet) thi bam dong y."""
    ok = visible(page.get_by_role("button", name=re.compile(r"^(OK|Yes|Confirm|Delete)$", re.I)))
    try:
        ok.first.click(timeout=2000)
    except Exception:  # noqa: BLE001
        pass


# ================================================================ KHACH HANG (Manage Customers)
def open_customers(page):
    open_grid(page, "Customers", "Manage Customers")
    text_visible(page, r"^Manage Customers$").wait_for(timeout=TIMEOUT)


def fill_customer(page, first=None, last=None, email=None, password=None, pw_label="Password"):
    if first is not None:
        field(page, "First Name").fill(first)
    if last is not None:
        field(page, "Last Name").fill(last)
    if email is not None:
        field(page, "Email").fill(email)
    if password is not None:
        field(page, pw_label).fill(password)


def open_new_customer(page):
    open_customers(page)
    button(page, "Add").click()
    text_visible(page, r"^New Customer$").wait_for(timeout=TIMEOUT)
    field(page, "Associate to Website").select_option(label=WEBSITE)


def create_customer(page, first, last, email, password):
    open_new_customer(page)
    fill_customer(page, first, last, email, password)
    button(page, "Save").click()
    wait_message(page, r"has been saved")


def show_account_tab(page):
    """Trang sua customer mo o tab 'Customer View': bam tab 'Account Information'."""
    first_name = field(page, "First Name")
    try:
        first_name.wait_for(timeout=3000)
    except Exception:  # noqa: BLE001
        visible(page.get_by_text("Account Information", exact=True)).first.click()
        first_name.wait_for(timeout=TIMEOUT)


def open_customer_edit(page, email):
    open_customers(page)
    grid_search(page, "email", email)
    check(grid_rows(page, email).count() >= 1, f"Khong tim thay customer {email} trong danh sach")
    open_row(page, email)
    show_account_tab(page)


def delete_customer(page, email):
    open_customers(page)
    grid_search(page, "email", email)
    if grid_rows(page, email).count() == 0:
        return
    open_row(page, email)
    show_account_tab(page)
    button(page, "Delete").click()
    confirm_modal(page)
    wait_message(page, r"has been deleted")


def test_adm_01_dang_nhap_admin(admin_page):
    page = admin_page
    for item in ("Dashboard", "Customers", "Promotions"):
        check(visible(page.get_by_text(item, exact=True)).count() > 0, f"Thieu menu {item}")


def test_cus_01_hien_thi_danh_sach_customers(admin_page):
    page = admin_page
    open_customers(page)
    check(button(page, "Add").is_visible(), "Thieu nut Add")
    for column in ("ID", "Name", "Email", "Group"):
        check(visible(page.get_by_role("columnheader", name=re.compile(f"^{column}$", re.I))).count() > 0,
              f"Thieu cot {column}")
    check(text_visible(page, r"\d+ items").is_visible(), "Thieu so luong ban ghi (items)")


def test_cus_02_tim_kiem_theo_email(admin_page, make_customer):
    data = make_customer()
    page = admin_page
    open_customers(page)
    grid_search(page, "email", data["email"])
    check(grid_rows(page, data["email"]).count() == 1, "Tim theo email khong ra dung 1 ket qua")


def test_cus_03_them_customer_hop_le(admin_page, make_customer):
    data = make_customer()
    page = admin_page
    open_customers(page)
    grid_search(page, "email", data["email"])
    row = grid_rows(page, data["email"])
    check(row.count() == 1, "Customer moi tao khong xuat hien trong danh sach")
    check(data["first"] in row.first.inner_text(), "Ten customer trong danh sach khong dung")


@pytest.mark.parametrize("missing", ["first", "last", "email", "password"])
def test_cus_04_07_bo_trong_truong_bat_buoc(admin_page, missing):
    """CUS-4 (First Name), CUS-5 (Last Name), CUS-6 (Email), CUS-7 (Password)."""
    page = admin_page
    data = new_customer_data()
    data[missing] = ""
    open_new_customer(page)
    fill_customer(page, **data)
    button(page, "Save").click()
    check(blocked(page), f"Khong chan/khong bao loi khi bo trong {missing}")
    check(text_visible(page, r"^New Customer$").is_visible(), "Roi khoi form them moi khi bo trong truong")


def test_cus_08_email_sai_dinh_dang(admin_page):
    page = admin_page
    data = new_customer_data()
    data["email"] = "abc"
    open_new_customer(page)
    fill_customer(page, **data)
    button(page, "Save").click()
    check(blocked(page, r"valid email"), "Khong bao loi khi email sai dinh dang")


def test_cus_09_email_da_ton_tai(admin_page, make_customer):
    old = make_customer()
    page = admin_page
    dup = new_customer_data()
    dup["email"] = old["email"]
    open_new_customer(page)
    fill_customer(page, **dup)
    button(page, "Save").click()
    check(blocked(page, r"already|exist"), "Khong bao loi khi email da ton tai")
    open_customers(page)
    grid_search(page, "email", old["email"])
    check(grid_rows(page, old["email"]).count() == 1, "Co 2 customer cung email")


def test_cus_10_mat_khau_qua_ngan(admin_page):
    page = admin_page
    data = new_customer_data()
    data["password"] = "123"
    open_new_customer(page)
    fill_customer(page, **data)
    button(page, "Save").click()
    check(blocked(page, r"7 or more|at least 7|characters"), "Khong bao loi khi mat khau duoi 7 ky tu")


def test_cus_11_sua_first_name(admin_page, make_customer):
    data = make_customer()
    page = admin_page
    new_first = data["first"] + "Edit"
    open_customer_edit(page, data["email"])
    field(page, "First Name").fill(new_first)
    button(page, "Save").click()
    wait_message(page, r"has been saved")
    open_customers(page)
    grid_search(page, "email", data["email"])
    check(new_first in grid_rows(page, data["email"]).first.inner_text(),
          "Ten moi khong duoc luu / khong hien thi trong danh sach")


def test_cus_12_sua_bo_trong_first_name(admin_page, make_customer):
    data = make_customer()
    page = admin_page
    open_customer_edit(page, data["email"])
    field(page, "First Name").fill("")
    button(page, "Save").click()
    check(blocked(page, r"required"), "Khong bao loi khi xoa trong First Name")
    open_customers(page)
    grid_search(page, "email", data["email"])
    check(data["first"] in grid_rows(page, data["email"]).first.inner_text(),
          "Du lieu cu khong duoc giu nguyen")


def test_cus_13_sua_email_trung_customer_khac(admin_page, make_customer):
    first = make_customer()
    second = make_customer()
    page = admin_page
    open_customer_edit(page, second["email"])
    field(page, "Email").fill(first["email"])
    button(page, "Save").click()
    check(blocked(page, r"already|exist"), "Khong bao loi khi doi sang email da ton tai")


def test_cus_14_xoa_customer(admin_page, make_customer):
    data = make_customer()
    page = admin_page
    delete_customer(page, data["email"])
    open_customers(page)
    grid_search(page, "email", data["email"])
    check(grid_rows(page, data["email"]).count() == 0, "Customer da xoa nhung van con trong danh sach")


# ================================================================ RULE (Catalog / Shopping Cart)
def open_rules(page, kind):
    open_grid(page, "Promotions", kind)
    text_visible(page, rf"^{re.escape(kind)}$").wait_for(timeout=TIMEOUT)


def open_tab(page, name):
    visible(page.get_by_text(name, exact=True)).first.click()


def fill_rule_info(page, name=None, status=None, websites=(WEBSITE,), groups=GROUPS,
                   coupon_code=None, from_date=None, to_date=None):
    """Tab Rule Information. websites/groups = () nghia la khong chon."""
    if name is not None:
        field(page, "Rule Name").fill(name)
    if status:
        field(page, "Status").select_option(label=status)
    if websites:
        field(page, "Websites").select_option(label=list(websites))
    if groups:
        field(page, "Customer Groups").select_option(label=list(groups))
    if coupon_code is not None:
        field(page, "Coupon").select_option(label="Specific Coupon")
        field(page, "Coupon Code").fill(coupon_code)
    if from_date:
        field(page, "From Date").fill(from_date)
    if to_date:
        field(page, "To Date").fill(to_date)


def fill_discount(page, amount):
    """Tab Actions: Discount Amount. Tab Conditions de trong."""
    open_tab(page, "Actions")
    field(page, "Discount Amount").fill(amount)


def open_new_rule(page, kind):
    open_rules(page, kind)
    button(page, "Add").click()
    text_visible(page, r"^New Rule$").wait_for(timeout=TIMEOUT)


def create_rule(page, kind, name, discount="10", status=None, coupon_code=None, **info):
    open_new_rule(page, kind)
    fill_rule_info(page, name=name, status=status, coupon_code=coupon_code, **info)
    fill_discount(page, discount)
    button(page, "Save").click()
    wait_message(page, r"has been saved")


def open_rule_edit(page, kind, name):
    open_rules(page, kind)
    grid_search(page, "name", name)
    check(grid_rows(page, name).count() >= 1, f"Khong tim thay rule '{name}' trong danh sach")
    open_row(page, name)
    field(page, "Rule Name").wait_for(timeout=TIMEOUT)


def delete_rule(page, kind, name):
    open_rules(page, kind)
    grid_search(page, "name", name)
    if grid_rows(page, name).count() == 0:
        return
    open_row(page, name)
    field(page, "Rule Name").wait_for(timeout=TIMEOUT)
    button(page, "Delete").click()
    confirm_modal(page)
    wait_message(page, r"has been deleted")


@pytest.mark.parametrize("kind", RULE_KINDS)
def test_rule_01_hien_thi_danh_sach(admin_page, kind):
    page = admin_page
    open_rules(page, kind)
    check(button(page, "Add").is_visible(), "Thieu nut Add")
    for column in (r"Rule Name|^Name$", r"^Status$"):
        check(visible(page.get_by_role("columnheader", name=re.compile(column, re.I))).count() > 0,
              f"Thieu cot {column}")


@pytest.mark.parametrize("kind", RULE_KINDS)
def test_rule_02_them_rule_hop_le(admin_page, make_rule, kind):
    name = make_rule(kind)
    page = admin_page
    open_rules(page, kind)
    grid_search(page, "name", name)
    check(grid_rows(page, name).count() == 1, "Rule moi tao khong xuat hien trong danh sach")


@pytest.mark.parametrize("kind", RULE_KINDS)
def test_rule_03_bo_trong_rule_name(admin_page, kind):
    page = admin_page
    open_new_rule(page, kind)
    fill_rule_info(page, name="")
    fill_discount(page, "10")
    button(page, "Save").click()
    check(blocked(page, r"required", tab="Rule Information"), "Khong bao loi khi bo trong Rule Name")


@pytest.mark.parametrize("kind", RULE_KINDS)
def test_rule_04_khong_chon_website(admin_page, kind):
    page = admin_page
    open_new_rule(page, kind)
    fill_rule_info(page, name=new_name("NoSite"), websites=())
    fill_discount(page, "10")
    button(page, "Save").click()
    check(blocked(page, r"required|select", tab="Rule Information"), "Khong bao loi khi khong chon Websites")


@pytest.mark.parametrize("kind", RULE_KINDS)
def test_rule_05_khong_chon_customer_group(admin_page, kind):
    page = admin_page
    open_new_rule(page, kind)
    fill_rule_info(page, name=new_name("NoGroup"), groups=())
    fill_discount(page, "10")
    button(page, "Save").click()
    check(blocked(page, r"required|select", tab="Rule Information"),
          "Khong bao loi khi khong chon Customer Groups")


@pytest.mark.parametrize("kind", RULE_KINDS)
def test_rule_06_bo_trong_discount_amount(admin_page, kind):
    page = admin_page
    open_new_rule(page, kind)
    fill_rule_info(page, name=new_name("NoDiscount"))
    fill_discount(page, "")
    button(page, "Save").click()
    check(blocked(page, r"required"), "Khong bao loi khi bo trong Discount Amount")


@pytest.mark.parametrize("kind", RULE_KINDS)
def test_rule_07_discount_amount_khong_phai_so(admin_page, kind):
    page = admin_page
    open_new_rule(page, kind)
    fill_rule_info(page, name=new_name("BadDiscount"))
    fill_discount(page, "abc")
    button(page, "Save").click()
    check(blocked(page, r"valid number|number"), "Khong bao loi khi Discount Amount la chu")


@pytest.mark.parametrize("kind", RULE_KINDS)
def test_rule_08_ngay_ket_thuc_truoc_ngay_bat_dau(admin_page, kind):
    page = admin_page
    open_new_rule(page, kind)
    fill_rule_info(page, name=new_name("BadDate"), from_date="2026-12-31", to_date="2026-01-01")
    fill_discount(page, "10")
    button(page, "Save").click()
    check(blocked(page, r"date"), "Cho phep luu khi To Date som hon From Date")


@pytest.mark.parametrize("kind", RULE_KINDS)
def test_rule_09_tim_kiem_theo_ten(admin_page, make_rule, kind):
    name = make_rule(kind)
    page = admin_page
    open_rules(page, kind)
    grid_search(page, "name", name)
    check(grid_rows(page, name).count() == 1, "Tim theo ten khong ra dung 1 ket qua")


@pytest.mark.parametrize("kind", RULE_KINDS)
def test_rule_10_sua_ten_rule(admin_page, make_rule, kind):
    name = make_rule(kind)
    page = admin_page
    new = name + " Edit"
    make_rule.track(kind, new)
    open_rule_edit(page, kind, name)
    field(page, "Rule Name").fill(new)
    button(page, "Save").click()
    wait_message(page, r"has been saved")
    open_rules(page, kind)
    grid_search(page, "name", new)
    check(grid_rows(page, new).count() == 1, "Ten moi khong duoc luu")


@pytest.mark.parametrize("kind", RULE_KINDS)
def test_rule_11_sua_discount_amount(admin_page, make_rule, kind):
    name = make_rule(kind, discount="10")
    page = admin_page
    open_rule_edit(page, kind, name)
    fill_discount(page, "25")
    button(page, "Save").click()
    wait_message(page, r"has been saved")
    open_rule_edit(page, kind, name)
    open_tab(page, "Actions")
    check(field(page, "Discount Amount").input_value() in ("25", "25.0000", "25.00"),
          "Discount Amount moi khong duoc luu")


@pytest.mark.parametrize("kind", RULE_KINDS)
def test_rule_12_doi_trang_thai(admin_page, make_rule, kind):
    name = make_rule(kind)
    page = admin_page
    open_rule_edit(page, kind, name)
    status = field(page, "Status")
    before = status.evaluate("el => el.options[el.selectedIndex].text")
    after = "Active" if before.strip() == "Inactive" else "Inactive"
    status.select_option(label=after)
    button(page, "Save").click()
    wait_message(page, r"has been saved")
    open_rules(page, kind)
    grid_search(page, "name", name)
    check(re.search(rf"\b{after}\b", grid_rows(page, name).first.inner_text()),
          f"Trang thai khong doi tu {before} sang {after}")


@pytest.mark.parametrize("kind", RULE_KINDS)
def test_rule_13_xoa_rule(admin_page, make_rule, kind):
    name = make_rule(kind)
    page = admin_page
    delete_rule(page, kind, name)
    open_rules(page, kind)
    grid_search(page, "name", name)
    check(grid_rows(page, name).count() == 0, "Rule da xoa nhung van con trong danh sach")


def test_rule_14_scr_tao_rule_voi_coupon_code(admin_page, make_rule):
    code = f"QA{uid()}"
    name = make_rule(SCR, coupon_code=code)
    page = admin_page
    open_rules(page, SCR)
    grid_search(page, "name", name)
    check(code in grid_rows(page, name).first.inner_text(), "Coupon code khong hien thi trong danh sach")


def test_rule_15_scr_coupon_code_trung(admin_page, make_rule):
    code = f"QA{uid()}"
    make_rule(SCR, coupon_code=code)
    page = admin_page
    open_new_rule(page, SCR)
    fill_rule_info(page, name=new_name("DupCoupon"), coupon_code=code)
    fill_discount(page, "10")
    button(page, "Save").click()
    check(blocked(page, r"already|exist|unique|duplicate"), "Cho phep 2 rule cung coupon code")
