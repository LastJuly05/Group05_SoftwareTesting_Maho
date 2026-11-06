import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { ProductsPage } from '../pages/ProductsPage';
import { newProduct, MESSAGES } from '../test-data/testData';

test.describe('Catalog > Products', () => {
  let products: ProductsPage;

  test.beforeEach(async ({ page }) => {
    await new LoginPage(page).loginAsAdmin();
    products = new ProductsPage(page);
    await products.open();
  });

  // ================= HIỂN THỊ & GRID =================
  test('TC_PRD_01 - Mở trang Manage Products hiển thị grid sản phẩm', async ({ page }) => {
    await expect(products.grid).toBeVisible();
    await expect(page).toHaveURL(/catalog_product/);
  });

  test('TC_PRD_02 - Grid hiển thị đầy đủ các cột chính', async () => {
    for (const col of ['ID', 'Name', 'Type', 'SKU', 'Price', 'Status']) {
      await expect(products.columnHeader(col), `Thiếu cột ${col}`).toBeVisible();
    }
  });

  test('TC_PRD_03 - Grid có ít nhất 1 sản phẩm và hiển thị tổng số bản ghi', async () => {
    expect(await products.rows.count()).toBeGreaterThan(0);
    await expect(products.recordsFound).toBeVisible();
  });

  test('TC_PRD_04 - Nút Add Product hiển thị', async () => {
    await expect(products.addProductBtn).toBeVisible();
  });

  // ================= TÌM KIẾM / LỌC =================
  test('TC_PRD_05 - Tìm kiếm sản phẩm theo Name', async () => {
    const name = (await products.cellTexts('^\\s*Name'))[0];
    await products.search({ name });
    const names = await products.cellTexts('^\\s*Name');
    expect(names.length).toBeGreaterThan(0);
    names.forEach((n) => expect(n.toLowerCase()).toContain(name.toLowerCase()));
  });

  test('TC_PRD_06 - Tìm kiếm sản phẩm theo SKU', async () => {
    const sku = (await products.cellTexts('^\\s*SKU'))[0];
    await products.search({ sku });
    const skus = await products.cellTexts('^\\s*SKU');
    expect(skus.length).toBeGreaterThan(0);
    skus.forEach((s) => expect(s.toLowerCase()).toContain(sku.toLowerCase()));
  });

  test('TC_PRD_07 - Tìm kiếm từ khoá không tồn tại -> No records found', async () => {
    await products.search({ name: 'zzz_khong_ton_tai_987654' });
    await expect(products.emptyRow).toBeVisible();
    await expect(products.emptyRow).toHaveText(MESSAGES.noRecords);
  });

  test('TC_PRD_08 - Tìm kiếm không phân biệt hoa thường', async () => {
    const name = (await products.cellTexts('^\\s*Name'))[0];
    await products.search({ name: name.toUpperCase() });
    expect(await products.rows.count()).toBeGreaterThan(0);
  });

  test('TC_PRD_09 - Lọc theo Status = Enabled', async () => {
    await products.search({ status: 'Enabled' });
    const statuses = await products.cellTexts('^\\s*Status');
    expect(statuses.length).toBeGreaterThan(0);
    statuses.forEach((s) => expect(s).toMatch(/Enabled/i));
  });

  test('TC_PRD_10 - Lọc theo Status = Disabled', async () => {
    await products.search({ status: 'Disabled' });
    const statuses = await products.cellTexts('^\\s*Status');
    statuses.forEach((s) => expect(s).toMatch(/Disabled/i));
  });

  test('TC_PRD_11 - Lọc theo Type = Simple Product', async () => {
    await products.search({ type: 'Simple Product' });
    const types = await products.cellTexts('^\\s*Type');
    expect(types.length).toBeGreaterThan(0);
    types.forEach((t) => expect(t).toMatch(/Simple/i));
  });

  test('TC_PRD_12 - Reset Filter xoá điều kiện lọc', async () => {
    await products.search({ name: 'zzz_khong_ton_tai_987654' });
    await products.resetFilter();
    await expect(products.filterName).toHaveValue('');
    expect(await products.rows.count()).toBeGreaterThan(0);
  });

  test('TC_PRD_13 - Sắp xếp theo Name khi click tiêu đề cột', async () => {
    await products.sortBy('Name');
    const asc = await products.cellTexts('^\\s*Name');
    expect(asc.length).toBeGreaterThan(0);
    await products.sortBy('Name');
    // Grid load bằng AJAX nên chờ dòng đầu tiên đổi sang thứ tự ngược lại
    await expect
      .poll(async () => (await products.cellTexts('^\\s*Name'))[0], { timeout: 15_000 })
      .not.toBe(asc[0]);
  });

  test('TC_PRD_14 - Đổi số bản ghi mỗi trang (per page) sang 50', async () => {
    const before = await products.rows.count();
    await products.limitSelect.selectOption('50');
    await expect
      .poll(async () => products.rows.count(), { timeout: 15_000 })
      .toBeGreaterThan(before);
    expect(await products.rows.count()).toBeLessThanOrEqual(50);
    await expect(products.limitSelect).toHaveValue('50');
  });

  // ================= TẠO MỚI =================
  test('TC_PRD_15 - Click Add Product mở trang chọn Attribute Set & Product Type', async ({ page }) => {
    await products.clickAddProduct();
    await expect(page).toHaveURL(/catalog_product\/new/);
    await expect(products.button(/^\s*Continue\s*$/i)).toBeVisible();
  });

  test('TC_PRD_16 - Chọn Simple Product và Continue mở form tạo sản phẩm', async ({ page }) => {
    await products.startNewSimpleProduct();
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#sku')).toBeVisible();
  });

  test('TC_PRD_17 - Tạo Simple Product với đầy đủ thông tin hợp lệ', async () => {
    const data = newProduct();
    await products.createSimpleProduct(data);
    await expect(products.successMsg.first()).toContainText(MESSAGES.productSaved);
    await products.open();
    await products.search({ sku: data.sku });
    expect(await products.rows.count()).toBe(1);
  });

  test('TC_PRD_18 - Tạo sản phẩm bỏ trống Name -> báo lỗi bắt buộc', async ({ page }) => {
    await products.startNewSimpleProduct();
    await products.fillProduct(newProduct({ name: '' }));
    await products.save();
    await products.expectFieldError('advice-required-entry-name', MESSAGES.required);
  });

  test('TC_PRD_19 - Tạo sản phẩm bỏ trống SKU -> báo lỗi bắt buộc', async ({ page }) => {
    await products.startNewSimpleProduct();
    await products.fillProduct(newProduct({ sku: '' }));
    await products.save();
    await products.expectFieldError('advice-required-entry-sku', MESSAGES.required);
  });

  test('TC_PRD_20 - Tạo sản phẩm bỏ trống Price -> báo lỗi bắt buộc', async ({ page }) => {
    await products.startNewSimpleProduct();
    await products.fillProduct(newProduct({ price: '' }));
    await products.save();
    await products.expectFieldError('advice-required-entry-price', MESSAGES.required);
  });

  test('TC_PRD_21 - Tạo sản phẩm với Price âm -> báo lỗi', async ({ page }) => {
    await products.startNewSimpleProduct();
    await products.fillProduct(newProduct({ price: '-10' }));
    await products.save();
    await products.expectFieldError('advice-validate-zero-or-greater-price', /0 or greater/i);
  });

  test('TC_PRD_22 - Tạo sản phẩm với SKU đã tồn tại -> hệ thống tự đổi SKU hoặc báo lỗi', async () => {
    const data = newProduct();
    await products.createSimpleProduct(data);
    await expect(products.successMsg.first()).toBeVisible();

    await products.open();
    await products.createSimpleProduct(newProduct({ sku: data.sku }));
    // Magento/Maho tự thêm hậu tố "-1" cho SKU trùng, hoặc hiển thị lỗi
    const saved = products.successMsg.first();
    const failed = products.errorMsg.first();
    const advice = products.page.locator('.validation-advice');
    await expect(saved.or(failed).or(advice).first()).toBeAttached();
  });

  // ================= SỬA / XOÁ =================
  test('TC_PRD_23 - Mở trang chỉnh sửa sản phẩm từ grid', async ({ page }) => {
    await products.openFirstRow();
    await expect(page).toHaveURL(/catalog_product\/edit/);
    await expect(page.locator('#name')).not.toHaveValue('');
  });

  test('TC_PRD_24 - Sửa tên sản phẩm và lưu thành công', async ({ page }) => {
    const data = newProduct();
    await products.createSimpleProduct(data);
    await products.open();
    await products.openProductBySku(data.sku);
    const newName = `${data.name} EDITED`;
    await page.locator('#name').fill(newName);
    await products.save();
    await expect(products.successMsg.first()).toContainText(MESSAGES.productSaved);
    await products.open();
    await products.search({ name: newName });
    expect(await products.rows.count()).toBeGreaterThan(0);
  });

  test('TC_PRD_25 - Đổi Status sang Disabled và lưu', async ({ page }) => {
    const data = newProduct();
    await products.createSimpleProduct(data);
    await products.open();
    await products.openProductBySku(data.sku);
    await page.locator('#status').selectOption({ label: 'Disabled' });
    await products.save();
    await expect(products.successMsg.first()).toContainText(MESSAGES.productSaved);
    await products.open();
    await products.search({ sku: data.sku });
    expect((await products.cellTexts('^\\s*Status'))[0]).toMatch(/Disabled/i);
  });

  test('TC_PRD_26 - Xoá sản phẩm thành công', async () => {
    const data = newProduct();
    await products.createSimpleProduct(data);
    await products.open();
    await products.openProductBySku(data.sku);
    await products.deleteCurrent();
    await expect(products.successMsg.first()).toContainText(MESSAGES.productDeleted);
    await products.search({ sku: data.sku });
    await expect(products.emptyRow).toBeVisible();
  });

  test('TC_PRD_27 - Mass action không chọn bản ghi nào -> thông báo chọn item', async () => {
    const message = await products.submitMassActionWithoutSelection();
    expect(message).toMatch(MESSAGES.selectItems);
  });

  test('TC_PRD_28 - Nhấn Back từ trang edit quay lại grid', async ({ page }) => {
    await products.openFirstRow();
    await products.button(/^\s*Back\s*$/i).click();
    await expect(products.grid).toBeVisible();
    await expect(page).toHaveURL(/catalog_product/);
  });
});