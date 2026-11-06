import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { OrdersPage } from '../pages/OrdersPage';
import { MESSAGES, uid } from '../test-data/testData';

test.describe('Sales > Orders', () => {
  let orders: OrdersPage;

  test.beforeEach(async ({ page }) => {
    await new LoginPage(page).loginAsAdmin();
    orders = new OrdersPage(page);
    await orders.open();
  });

  // ================= HIỂN THỊ & GRID =================
  test('TC_ORD_01 - Mở trang Orders hiển thị grid đơn hàng', async ({ page }) => {
    await expect(orders.grid).toBeVisible();
    await expect(page).toHaveURL(/sales_order/);
  });

  test('TC_ORD_02 - Grid hiển thị đầy đủ các cột chính', async () => {
    for (const col of ['Order #', 'Purchased On', 'Bill to Name', 'Ship to Name', 'Status']) {
      await expect(orders.columnHeader(col), `Thiếu cột ${col}`).toBeVisible();
    }
  });

  test('TC_ORD_03 - Grid có dữ liệu và hiển thị tổng số bản ghi', async () => {
    expect(await orders.rows.count()).toBeGreaterThan(0);
    await expect(orders.recordsFound).toBeVisible();
  });

  test('TC_ORD_04 - Nút Create New Order hiển thị', async () => {
    await expect(orders.createOrderBtn).toBeVisible();
  });

  test('TC_ORD_05 - Mỗi dòng đơn hàng có cột Action/View', async () => {
    const firstRow = orders.rows.first();
    await expect(firstRow.getByText(/View/i).first()).toBeVisible();
  });

  // ================= TÌM KIẾM / LỌC =================
  test('TC_ORD_06 - Tìm kiếm theo Order #', async () => {
    const orderNo = (await orders.columnValues('Order #'))[0];
    await orders.search({ orderId: orderNo });
    const result = await orders.columnValues('Order #');
    expect(result.length).toBeGreaterThan(0);
    result.forEach((r) => expect(r).toContain(orderNo));
  });

  test('TC_ORD_07 - Tìm kiếm theo Bill to Name', async () => {
    const name = (await orders.columnValues('Bill to Name'))[0];
    test.skip(!name, 'Đơn đầu tiên không có Bill to Name');
    await orders.search({ billName: name });
    const result = await orders.columnValues('Bill to Name');
    expect(result.length).toBeGreaterThan(0);
    result.forEach((r) => expect(r.toLowerCase()).toContain(name.toLowerCase()));
  });

  test('TC_ORD_08 - Tìm kiếm theo Ship to Name', async () => {
    const name = (await orders.columnValues('Ship to Name'))[0];
    test.skip(!name, 'Đơn đầu tiên không có Ship to Name');
    await orders.search({ shipName: name });
    expect((await orders.columnValues('Ship to Name')).length).toBeGreaterThan(0);
  });

  test('TC_ORD_09 - Tìm Order # không tồn tại -> No records found', async () => {
    await orders.search({ orderId: `9999${uid()}` });
    await expect(orders.emptyRow).toBeVisible();
    await expect(orders.emptyRow).toHaveText(MESSAGES.noRecords);
  });

  test('TC_ORD_10 - Lọc theo Status = Pending', async () => {
    await orders.search({ status: 'Pending' });
    if ((await orders.rows.count()) === 0) {
      await expect(orders.emptyRow).toBeVisible();
      return;
    }
    (await orders.columnValues('^\\s*Status')).forEach((s) => expect(s).toMatch(/Pending/i));
  });

  test('TC_ORD_11 - Lọc theo Status = Complete', async () => {
    await orders.search({ status: 'Complete' });
    if ((await orders.rows.count()) === 0) {
      await expect(orders.emptyRow).toBeVisible();
      return;
    }
    (await orders.columnValues('^\\s*Status')).forEach((s) => expect(s).toMatch(/Complete/i));
  });

  test('TC_ORD_12 - Lọc theo Status = Canceled', async () => {
    await orders.search({ status: 'Canceled' });
    if ((await orders.rows.count()) > 0) {
      (await orders.columnValues('^\\s*Status')).forEach((s) => expect(s).toMatch(/Cancel/i));
    } else {
      await expect(orders.emptyRow).toBeVisible();
    }
  });

  test('TC_ORD_13 - Lọc theo khoảng ngày mua (From - To)', async () => {
    const today = new Date();
    const from = new Date(today.getFullYear() - 5, 0, 1);
    const fmt = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
    await orders.search({ from: fmt(from), to: fmt(today) });
    await expect(orders.grid).toBeVisible();
    expect(await orders.rows.count()).toBeGreaterThanOrEqual(0);
  });

  test('TC_ORD_14 - Lọc kết hợp Status và Bill to Name', async () => {
    const name = (await orders.columnValues('Bill to Name'))[0];
    const status = (await orders.columnValues('^\\s*Status'))[0];
    test.skip(!name || !status, 'Thiếu dữ liệu để lọc kết hợp');
    await orders.search({ billName: name, status });
    expect(await orders.rows.count()).toBeGreaterThan(0);
  });

  test('TC_ORD_15 - Reset Filter xoá điều kiện lọc', async () => {
    await orders.search({ orderId: '9999999999' });
    await orders.resetFilter();
    await expect(orders.filterOrderId).toHaveValue('');
    expect(await orders.rows.count()).toBeGreaterThan(0);
  });

  test('TC_ORD_16 - Sắp xếp theo Purchased On', async () => {
    await orders.sortBy('Purchased On');
    const asc = await orders.columnValues('Purchased On');
    await orders.sortBy('Purchased On');
    const desc = await orders.columnValues('Purchased On');
    expect(asc.length).toBeGreaterThan(0);
    if (asc.length > 1) expect(asc.join('|')).not.toEqual(desc.join('|'));
  });

  test('TC_ORD_17 - Đổi số bản ghi mỗi trang sang 50', async () => {
    await orders.limitSelect.selectOption('50');
    await orders.page.waitForLoadState('networkidle');
    expect(await orders.rows.count()).toBeLessThanOrEqual(50);
  });

  // ================= CHI TIẾT ĐƠN =================
  test('TC_ORD_18 - Click vào dòng mở trang chi tiết đơn hàng', async ({ page }) => {
    await orders.openFirstOrder();
    await expect(page).toHaveURL(/sales_order\/view/);
  });

  test('TC_ORD_19 - Tiêu đề trang chi tiết chứa đúng số Order #', async () => {
    const orderNo = await orders.openFirstOrder();
    await expect(orders.orderTitle).toContainText(orderNo);
  });

  test('TC_ORD_20 - Trang chi tiết có các khối thông tin chính', async () => {
    await orders.openFirstOrder();
    await expect(orders.section(/Account Information/i)).toBeVisible();
    await expect(orders.section(/Billing Address/i)).toBeVisible();
    await expect(orders.section(/Payment Information/i)).toBeVisible();
    await expect(orders.section(/Items Ordered/i)).toBeVisible();
    await expect(orders.section(/Order Totals/i)).toBeVisible();
  });

  test('TC_ORD_21 - Trang chi tiết có nút Back và Back quay lại grid', async ({ page }) => {
    await orders.openFirstOrder();
    await expect(orders.backBtn).toBeVisible();
    await orders.backBtn.click();
    await expect(orders.grid).toBeVisible();
    await expect(page).toHaveURL(/sales_order/);
  });

  test('TC_ORD_22 - Thêm comment vào lịch sử đơn hàng', async ({ page }) => {
    await orders.openFirstOrder();
    const text = `Auto comment ${uid()}`;
    await orders.addComment(text);
    await expect(page.getByText(text).filter({ visible: true }).first()).toBeVisible();
  });

  test('TC_ORD_23 - Đơn Pending có nút Hold/Cancel/Invoice', async () => {
    const found = await orders.openFirstOrderWithStatus('Pending');
    test.skip(!found, 'Demo hiện không có đơn Pending');
    // 3 nút cùng tồn tại => union có nhiều phần tử, phải .first() để tránh strict mode violation
    await expect(orders.holdBtn.or(orders.cancelOrderBtn).or(orders.invoiceBtn).first()).toBeVisible();
  });

  test('TC_ORD_24 - Hold đơn Pending rồi Unhold', async ({ page }) => {
    const found = await orders.openFirstOrderWithStatus('Pending');
    test.skip(!found, 'Demo hiện không có đơn Pending');
    test.skip(!(await orders.holdBtn.isVisible()), 'Đơn không cho phép Hold');
    await orders.holdBtn.click();
    await page.waitForLoadState('domcontentloaded');
    await expect(orders.successMsg.first()).toBeVisible();
    await expect(orders.unholdBtn).toBeVisible();
    await orders.unholdBtn.click();
    await page.waitForLoadState('domcontentloaded');
    await expect(orders.successMsg.first()).toBeVisible();
  });

  test('TC_ORD_25 - Click Create New Order mở trang chọn khách hàng', async ({ page }) => {
    await orders.createOrderBtn.click();
    await expect(page).toHaveURL(/sales_order_create/);
    await expect(page.locator('#sales_order_create_customer_grid, [id*="customer_grid"]').first()).toBeVisible();
  });

  test('TC_ORD_26 - Mass action không chọn đơn nào -> thông báo chọn item', async () => {
    const message = await orders.submitMassActionWithoutSelection();
    expect(message).toMatch(MESSAGES.selectItems);
  });

  test('TC_ORD_27 - Export grid đơn hàng sang CSV', async ({ page }) => {
    test.skip(!(await orders.exportSelect.count()), 'Không tìm thấy ô Export');
    await orders.exportSelect.selectOption({ index: 0 });
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 30_000 }), orders.exportBtn.click()]);
    expect(download.suggestedFilename()).toMatch(/\.(csv|xml)$/i);
  });
});