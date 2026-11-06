import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { CategoriesPage, DEFAULT_NODE } from '../pages/CategoriesPage';
import { newCategory, MESSAGES, SPECIAL_TEXT, uid } from '../test-data/testData';

test.describe('Catalog > Categories', () => {
  let categories: CategoriesPage;

  test.beforeEach(async ({ page }) => {
    await new LoginPage(page).loginAsAdmin();
    categories = new CategoriesPage(page);
    await categories.open();
  });

  // ================= HIỂN THỊ =================
  test('TC_CAT_01 - Mở trang Manage Categories thành công', async ({ page }) => {
    await expect(page).toHaveURL(/catalog_category/);
    await expect(categories.addSubBtn).toBeVisible();
  });

  test('TC_CAT_02 - Cây danh mục hiển thị ít nhất 1 node', async () => {
    expect(await categories.allNodes.count()).toBeGreaterThan(0);
  });

  test('TC_CAT_03 - Hiển thị nút Add Root Category và Add Subcategory', async () => {
    await expect(categories.addRootBtn).toBeVisible();
    await expect(categories.addSubBtn).toBeVisible();
  });

  test('TC_CAT_04 - Expand All mở rộng toàn bộ cây', async () => {
    await categories.collapseAllLink.click();
    const before = await categories.openFolders.count();
    await categories.expandAllLink.click();
    await expect
      .poll(async () => categories.openFolders.count(), { timeout: 10_000 })
      .toBeGreaterThanOrEqual(before);
    expect(await categories.openFolders.count()).toBeGreaterThan(0);
  });

  test('TC_CAT_05 - Collapse All thu gọn cây', async () => {
    await categories.expandAllLink.click();
    const expanded = await categories.openFolders.count();
    await categories.collapseAllLink.click();
    await expect
      .poll(async () => categories.openFolders.count(), { timeout: 10_000 })
      .toBeLessThanOrEqual(expanded);
  });

  test('TC_CAT_06 - Click vào node hiển thị form chi tiết danh mục', async () => {
    await categories.selectNode(DEFAULT_NODE);
    await expect(categories.nameInput).toBeVisible();
    await expect(categories.nameInput).not.toHaveValue('');
  });

  test('TC_CAT_07 - Form có đủ các tab chính', async ({ page }) => {
    await categories.selectNode(DEFAULT_NODE);
    for (const tab of [/General Information/i, /Display Settings/i, /Custom Design/i, /Category Products/i]) {
      await expect(page.getByRole('tab', { name: tab })).toBeVisible();
    }
  });

  test('TC_CAT_08 - Tab General Information có các trường Name, Is Active, URL Key', async () => {
    // "Default Category" là category gốc (root) nên form không có URL Key => dùng danh mục con vừa tạo
    const data = newCategory();
    await categories.createSubcategory({ ...data, active: 'Yes' });
    await categories.selectNode(data.name);
    await categories.openTab(/General Information/i);
    await expect(categories.nameInput).toBeVisible();
    await expect(categories.isActiveSelect).toBeVisible();
    await expect(categories.urlKeyInput).toBeVisible();
  });

  // ================= THÊM MỚI =================
  test('TC_CAT_09 - Add Subcategory hiển thị form trống', async () => {
    await categories.startSubcategory();
    await expect(categories.nameInput).toHaveValue('');
  });

  test('TC_CAT_10 - Thêm danh mục con với dữ liệu hợp lệ', async () => {
    const data = newCategory();
    await categories.createSubcategory({ ...data, active: 'Yes' });
    await expect(categories.successMsg.first()).toContainText(MESSAGES.categorySaved);
    await expect(categories.node(data.name)).toBeVisible();
  });

  test('TC_CAT_11 - Thêm danh mục để trống Name -> báo lỗi bắt buộc', async ({ page }) => {
    await categories.startSubcategory();
    await categories.fillCategory({ name: '', active: 'Yes' });
    await categories.save();
    await expect(page.locator('.validation-advice, .error-msg').first()).toContainText(MESSAGES.required);
  });

  test('TC_CAT_12 - Thêm danh mục với trạng thái Is Active = No', async () => {
    const data = newCategory();
    await categories.createSubcategory({ ...data, active: 'No' });
    await expect(categories.successMsg.first()).toContainText(MESSAGES.categorySaved);
    await categories.selectNode(data.name);
    await expect(categories.isActiveSelect).toHaveValue('0');
  });

  test('TC_CAT_13 - Thêm danh mục với URL Key tuỳ chỉnh', async () => {
    const data = newCategory();
    await categories.createSubcategory({ ...data, active: 'Yes' });
    await categories.selectNode(data.name);
    await expect(categories.urlKeyInput).toHaveValue(data.urlKey);
  });

  test('TC_CAT_14 - Thêm danh mục với Meta Title và Meta Description', async () => {
    const data = newCategory();
    await categories.createSubcategory({ ...data, active: 'Yes' });
    await categories.selectNode(data.name);
    await categories.openTab(/General Information/i);
    await expect(categories.metaTitleInput).toHaveValue(data.metaTitle);
    await expect(categories.metaDescInput).toHaveValue(data.metaDescription);
  });

  test('TC_CAT_15 - Thêm danh mục tên chứa ký tự đặc biệt', async () => {
    const data = newCategory({ name: `${SPECIAL_TEXT.special} ${uid()}`, urlKey: `special-${uid()}` });
    await categories.createSubcategory({ ...data, active: 'Yes' });
    await expect(categories.successMsg.first()).toContainText(MESSAGES.categorySaved);
  });

  test('TC_CAT_16 - Thêm danh mục tên chứa mã script (XSS) không bị thực thi', async ({ page }) => {
    let alerted = false;
    page.on('dialog', async (d) => {
      alerted = true;
      await d.dismiss();
    });
    const data = newCategory({ name: SPECIAL_TEXT.xss, urlKey: `xss-${uid()}` });
    await categories.createSubcategory({ ...data, active: 'Yes' });
    await page.waitForTimeout(1000);
    expect(alerted).toBeFalsy();
  });

  test('TC_CAT_17 - Thêm danh mục với tên rất dài (300 ký tự)', async ({ page }) => {
    const data = newCategory({ name: SPECIAL_TEXT.long, urlKey: `long-${uid()}` });
    await categories.createSubcategory({ ...data, active: 'Yes' });
    const ok = categories.successMsg.first();
    const fail = page.locator('.validation-advice, .error-msg').first();
    await expect(ok.or(fail)).toBeVisible();
  });

  test('TC_CAT_18 - Thêm danh mục trùng URL Key với danh mục đã có', async ({ page }) => {
    const first = newCategory();
    await categories.createSubcategory({ ...first, active: 'Yes' });
    await expect(categories.successMsg.first()).toBeVisible();
    await categories.createSubcategory({ ...newCategory({ urlKey: first.urlKey }), active: 'Yes' });
    const ok = categories.successMsg.first();
    const fail = categories.errorMsg.first();
    await expect(ok.or(fail)).toBeVisible();
  });

  test('TC_CAT_19 - Thêm Root Category mới', async ({ page }) => {
    await categories.startRoot();
    const data = newCategory();
    await categories.fillCategory({ name: data.name, active: 'Yes' });
    await categories.save();
    await expect(categories.successMsg.first()).toContainText(MESSAGES.categorySaved);
  });

  // ================= SỬA =================
  test('TC_CAT_20 - Sửa tên danh mục và lưu thành công', async () => {
    const data = newCategory();
    await categories.createSubcategory({ ...data, active: 'Yes' });
    await categories.selectNode(data.name);
    const newName = `${data.name} EDITED`;
    await categories.fillCategory({ name: newName });
    await categories.save();
    await expect(categories.successMsg.first()).toContainText(MESSAGES.categorySaved);
    await expect(categories.node(newName)).toBeVisible();
  });

  test('TC_CAT_21 - Đổi trạng thái danh mục từ Yes sang No', async () => {
    const data = newCategory();
    await categories.createSubcategory({ ...data, active: 'Yes' });
    await categories.selectNode(data.name);
    await categories.fillCategory({ active: 'No' });
    await categories.save();
    await expect(categories.successMsg.first()).toContainText(MESSAGES.categorySaved);
    await categories.selectNode(data.name);
    await expect(categories.isActiveSelect).toHaveValue('0');
  });

  test('TC_CAT_22 - Nút Reset khôi phục giá trị ban đầu của form', async () => {
    const data = newCategory();
    await categories.createSubcategory({ ...data, active: 'Yes' });
    await categories.selectNode(data.name);
    await categories.nameInput.fill('Gia tri tam thoi');
    await categories.reset();
    await expect(categories.nameInput).toHaveValue(data.name);
  });

  test('TC_CAT_23 - Tab Display Settings hiển thị các tuỳ chọn hiển thị', async ({ page }) => {
    await categories.selectNode(DEFAULT_NODE);
    await categories.openDisplaySettings();
    await expect(page.getByText(/Display Mode|Anchor|Available Product Listing Sort By/i).first()).toBeVisible();
  });

  test('TC_CAT_24 - Tab Category Products hiển thị grid sản phẩm trong danh mục', async ({ page }) => {
    await categories.selectNode(DEFAULT_NODE);
    await categories.openCategoryProducts();
    await expect(categories.categoryProductsGrid).toBeVisible();
  });

  test('TC_CAT_25 - Gán sản phẩm vào danh mục mới tạo', async ({ page }) => {
    const data = newCategory();
    await categories.createSubcategory({ ...data, active: 'Yes' });
    await categories.selectNode(data.name);
    await categories.openCategoryProducts();
    // Bộ lọc mặc định là "Yes" (sản phẩm đã thuộc danh mục = 0). Chọn option rỗng (Any) để thấy mọi sản phẩm
    const grid = categories.categoryProductsGrid;
    await grid.locator('select[name="in_category"]').first().selectOption('');
    await Promise.all([
      page.waitForResponse((r) => /catalog_category\/grid/.test(r.url()), { timeout: 30_000 }).catch(() => null),
      grid.getByRole('button', { name: /^\s*Search\s*$/i }).first().click(),
    ]);
    const firstCheckbox = grid.locator('tbody input[type="checkbox"]').first();
    await expect(firstCheckbox).toBeAttached();
    await firstCheckbox.check({ force: true });
    await categories.save();
    await expect(categories.successMsg.first()).toContainText(MESSAGES.categorySaved);
  });

  // ================= XOÁ =================
  test('TC_CAT_26 - Huỷ hộp thoại xác nhận xoá thì danh mục vẫn còn', async () => {
    const data = newCategory();
    await categories.createSubcategory({ ...data, active: 'Yes' });
    await categories.selectNode(data.name);
    categories.dismissNextDialog();
    await categories.deleteBtn.click();
    await categories.page.waitForTimeout(1000); // không có request nào khi huỷ confirm
    await expect(categories.node(data.name)).toBeVisible();
  });

  test('TC_CAT_27 - Xoá danh mục thành công', async () => {
    const data = newCategory();
    await categories.createSubcategory({ ...data, active: 'Yes' });
    await categories.selectNode(data.name);
    await categories.deleteSelected();
    // Nếu server từ chối xoá, in ra nội dung thông báo để biết lý do thay vì chỉ báo "không thấy success"
    await expect(categories.anyMessage).toBeVisible();
    await expect(categories.anyMessage, 'Server không xoá được danh mục').toContainText(MESSAGES.categoryDeleted);
    await expect(categories.node(data.name)).toHaveCount(0);
  });
});