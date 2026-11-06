import { test, expect, Page } from '@playwright/test';

const ADMIN_URL = 'https://demo.mahocommerce.com/admin2941834';
const USERNAME = 'demo';
const PASSWORD = 'demo1234demo1234';

async function login(page: Page) {
  await page.goto(ADMIN_URL);
  await page.locator('input[name="login[username]"]').fill(USERNAME);
  await page.locator('input[name="login[password]"]').fill(PASSWORD);
  await page.locator('input[name="login[password]"]').press('Enter');
  await expect(page.getByRole('link', { name: 'Dashboard' }).first()).toBeVisible();
}

async function closeIncomingMessage(page: Page) {
  const popup = page.getByText('Incoming Message');
  try {
    await popup.waitFor({ state: 'visible', timeout: 4000 });
    await page.locator('dialog, [role="dialog"], .message-popup').getByRole('button', { name: /close|×|✕/i }).first().click();
  } catch {
    await page.keyboard.press('Escape');
  }
}

async function goToSearchTerms(page: Page) {
  const catalog = page.getByRole('link', { name: 'Catalog', exact: true });
  await catalog.hover();
  const link = page.getByRole('link', { name: 'Search Terms', exact: true }).first();
  if (!(await link.isVisible().catch(() => false))) await catalog.hover();
  await link.click();
  await expect(page.getByRole('heading', { name: 'Search', exact: true })).toBeVisible();
  await expect(gridRows(page).first()).toBeVisible();
}

async function openAddSearch(page: Page) {
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByRole('heading', { name: 'New Search' })).toBeVisible();
}

async function selectFirstStore(page: Page) {
  const select = page.locator('select[name="store_id"]');
  const value = await select.locator('option:not([value=""])').first().getAttribute('value');
  await select.selectOption(value!);
}

async function expectSaved(page: Page) {
  const ok = page.locator('.success-msg, .messages .success').or(page.getByText(/(has been|was) saved/i));
  try {
    await expect(ok.first()).toBeVisible({ timeout: 15000 });
  } catch (e) {
    const msgs = await page.locator('.messages, [role="alert"], .error-msg, .notice-msg, [class*="msg"]').allInnerTexts();
    const invalid = await page.locator('.validation-advice, .required-entry, :invalid').allInnerTexts().catch(() => []);
    console.log('URL sau khi Save:', page.url());
    console.log('Thông báo trên trang:', msgs);
    console.log('Field không hợp lệ:', invalid);
    throw e;
  }
}

async function applyFilter(page: Page) {
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await page.waitForLoadState('networkidle');
}

async function createTerm(page: Page, query: string, options: { synonym?: string; redirect?: string; display?: 'Yes' | 'No' } = {}) {
  await openAddSearch(page);
  await queryInput(page).fill(query);
  await selectFirstStore(page);
  if (options.synonym) await page.locator('input[name="synonym_for"]').fill(options.synonym);
  if (options.redirect) await page.locator('input[name="redirect"]').fill(options.redirect);
  if (options.display) await page.locator('select[name="display_in_terms"]').selectOption({ label: options.display });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expectSaved(page);
}

async function findInGrid(page: Page, query: string) {
  await gridQueryFilter(page).fill(query);
  await applyFilter(page);
  await expect(gridRows(page).first()).toContainText(query);
}

async function openEditFirstRow(page: Page) {
  await gridRows(page).first().getByRole('link', { name: 'Edit' }).click();
  await expect(page.getByRole('heading', { name: /Edit Search/ })).toBeVisible();
}

const uniqueQuery = (prefix = 'qa term') => `${prefix} ${Date.now()}`;

const queryInput = (p: Page) => p.locator('input[name="query_text"]');
const gridQueryFilter = (p: Page) => p.locator('#catalog_search_grid input[name="search_query"]');
const gridRows = (p: Page) => p.locator('#catalog_search_grid_table tbody tr');
const gridPager = (p: Page) => p.locator('#catalog_search_grid td.pager');
const columnTexts = async (p: Page, index: number) =>
  (await gridRows(p).locator(`td:nth-child(${index})`).allInnerTexts()).map(s => s.trim());

test.describe('Maho Admin - Catalog > Search Terms', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await closeIncomingMessage(page);
    await goToSearchTerms(page);
  });

  test.describe('Grid - Search', () => {
    test('TC01 - Hiển thị đúng tiêu đề và nút Add', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Search', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Add' })).toBeVisible();
    });

    test('TC02 - Grid hiển thị đủ các cột', async ({ page }) => {
      const head = page.locator('#catalog_search_grid_table thead');
      for (const col of ['ID', 'Search Query', 'Store', 'Results', 'Number of Uses', 'Synonym For', 'Redirect', 'Display in Suggested Terms', 'Action']) {
        await expect(head.getByText(col, { exact: true })).toBeVisible();
      }
    });

    test('TC03 - Grid có dữ liệu và hiển thị tổng số items', async ({ page }) => {
      await expect(gridPager(page).getByText(/\d+ items/)).toBeVisible();
      await expect.poll(() => gridRows(page).count()).toBeGreaterThan(0);
    });

    test('TC04 - Mặc định 20 dòng mỗi trang', async ({ page }) => {
      await expect(page.locator('select[name="limit"]')).toHaveValue('20');
      await expect.poll(() => gridRows(page).count()).toBeLessThanOrEqual(20);
    });

    test('TC05 - Đổi số dòng mỗi trang sang 50', async ({ page }) => {
      await page.locator('select[name="limit"]').selectOption('50');
      await expect(page.locator('select[name="limit"]')).toHaveValue('50');
      await expect.poll(() => gridRows(page).count()).toBeGreaterThan(20);
      await expect.poll(() => gridRows(page).count()).toBeLessThanOrEqual(50);
    });

    test('TC06 - Phân trang: sang trang 2', async ({ page }) => {
      const pageInput = page.locator('input[name="page"]');
      await pageInput.fill('2');
      await pageInput.press('Enter');
      await expect(pageInput).toHaveValue('2');
    });

    test('TC07 - Lọc theo Search Query', async ({ page }) => {
      await gridQueryFilter(page).fill('serum');
      await applyFilter(page);
      await expect(gridRows(page).first()).toContainText('serum');
    });

    test('TC08 - Lọc không có kết quả', async ({ page }) => {
      await gridQueryFilter(page).fill('zzz_khong_ton_tai_123');
      await applyFilter(page);
      await expect(page.locator('#catalog_search_grid_table td.empty-text')).toHaveText(/No records found/i);
      await expect(gridPager(page).getByText(/\b0 items/)).toBeVisible();
    });

    test('TC09 - Reset Filter xoá bộ lọc', async ({ page }) => {
      await gridQueryFilter(page).fill('abc_filter');
      await applyFilter(page);
      await page.getByRole('button', { name: 'Reset Filter' }).click();
      await expect(gridQueryFilter(page)).toHaveValue('');
    });

    test('TC10 - Sắp xếp theo cột ID đảo chiều', async ({ page }) => {
      const header = page.locator('#catalog_search_grid_table thead').getByText('ID', { exact: true });
      await header.click();
      await expect.poll(async () => {
        const ids = (await columnTexts(page, 2)).map(Number);
        return ids[0] > ids[ids.length - 1];
      }).toBe(true);
      await header.click();
      await expect.poll(async () => {
        const ids = (await columnTexts(page, 2)).map(Number);
        return ids[0] < ids[ids.length - 1];
      }).toBe(true);
    });

    test('TC11 - Lọc theo Display in Suggested Terms = Yes', async ({ page }) => {
      await page.locator('#catalog_search_grid select[name="display_in_terms"]').selectOption({ label: 'Yes' });
      await applyFilter(page);
      await expect.poll(async () => {
        const values = await columnTexts(page, 9);
        return values.length > 0 && values.every(v => v === 'Yes');
      }).toBe(true);
    });

    test('TC12 - Mỗi dòng có link Edit', async ({ page }) => {
      await expect(gridRows(page).first().getByRole('link', { name: 'Edit' })).toBeVisible();
    });

    test('TC13 - Chọn Visible rồi None trong mass action', async ({ page }) => {
      const grid = page.locator('#catalog_search_grid');
      await grid.getByText('Visible', { exact: true }).click();
      await expect(grid.getByText(/\b[1-9]\d* selected/)).toBeVisible();
      await grid.getByText('None', { exact: true }).click();
      await expect(grid.getByText(/\b0 selected/)).toBeVisible();
    });

    test('TC14 - Click Edit mở trang Edit Search', async ({ page }) => {
      await openEditFirstRow(page);
    });
  });

  test.describe('Add New Search - UI', () => {
    test.beforeEach(async ({ page }) => {
      await openAddSearch(page);
    });

    test('TC15 - Click Add mở form New Search với đủ nút', async ({ page }) => {
      await expect(page.getByRole('button', { name: /Back/ })).toBeVisible();
      for (const name of ['Reset', 'Save']) {
        await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
      }
    });

    test('TC16 - Form có đủ field và giá trị mặc định', async ({ page }) => {
      await expect(queryInput(page)).toBeVisible();
      await expect(page.locator('select[name="store_id"]')).toBeVisible();
      await expect(page.locator('input[name="synonym_for"]')).toBeVisible();
      await expect(page.locator('input[name="redirect"]')).toBeVisible();
      await expect(page.locator('select[name="display_in_terms"]')).toHaveValue('0');
      await expect(page.getByText('ex. http://domain.com')).toBeVisible();
    });

    test('TC17 - Form New Search không có Number of results và Number of Uses', async ({ page }) => {
      await expect(page.locator('input[name="num_results"]')).toHaveCount(0);
      await expect(page.locator('input[name="popularity"]')).toHaveCount(0);
    });

    test('TC18 - Display in Suggested Terms có đủ Yes/No', async ({ page }) => {
      const select = page.locator('select[name="display_in_terms"]');
      await expect(select).toContainText('Yes');
      await expect(select).toContainText('No');
      await select.selectOption({ label: 'Yes' });
      await expect(select).toHaveValue('1');
    });

    test('TC19 - Nút Back quay lại grid Search', async ({ page }) => {
      await page.getByRole('button', { name: 'Back' }).click();
      await expect(page.getByRole('heading', { name: 'Search', exact: true })).toBeVisible();
    });

    test('TC20 - Nút Reset xoá dữ liệu đã nhập', async ({ page }) => {
      await queryInput(page).fill('du lieu tam');
      await page.getByRole('button', { name: 'Reset' }).click();
      await expect(queryInput(page)).toHaveValue('');
    });
  });

  test.describe('Add New Search - Validation & Create', () => {
    test('TC21 - Save khi để trống Search Query và Store -> báo required', async ({ page }) => {
      await openAddSearch(page);
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'New Search' })).toBeVisible();
      await expect(page.getByText(/required/i).first()).toBeVisible();
    });

    test('TC22 - Tạo search term thành công với dữ liệu hợp lệ', async ({ page }) => {
      const query = uniqueQuery();
      await createTerm(page, query);
      await findInGrid(page, query);
    });

    test('TC23 - Tạo search term với Synonym, Redirect và hiển thị Suggested Terms', async ({ page }) => {
      const query = uniqueQuery('qa full');
      await createTerm(page, query, { synonym: 'serum', redirect: 'https://example.com', display: 'Yes' });
      await findInGrid(page, query);
      await expect(gridRows(page).first()).toContainText('serum');
      await expect(gridRows(page).first()).toContainText('https://example.com');
      await expect(gridRows(page).first()).toContainText('Yes');
    });

    test('TC24 - Tạo search term trùng Search Query cùng Store -> báo lỗi', async ({ page }) => {
      await openAddSearch(page);
      await queryInput(page).fill('serum');
      await selectFirstStore(page);
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      const err = page.locator('.error-msg, .messages .error').or(page.getByText(/already exists/i));
      await expect(err.first()).toBeVisible({ timeout: 20000 });
    });
  });

  test.describe('Edit Search', () => {
    test('TC25 - Form Edit hiển thị đúng dữ liệu của dòng đã chọn', async ({ page }) => {
      const expected = (await gridRows(page).first().locator('td:nth-child(3)').innerText()).trim();
      await openEditFirstRow(page);
      await expect(queryInput(page)).toHaveValue(expected);
      await expect(page.getByRole('heading', { name: new RegExp(`Edit Search\\s+'?${expected}'?`) })).toBeVisible();
    });

    test('TC26 - Form Edit có thêm Number of results, Number of Uses và nút Delete', async ({ page }) => {
      await openEditFirstRow(page);
      await expect(page.locator('input[name="num_results"]')).toBeVisible();
      await expect(page.locator('input[name="popularity"]')).toBeVisible();
      for (const name of ['Back', 'Reset', 'Delete', 'Save']) {
        await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
      }
    });

    test('TC27 - Sửa search term do mình tạo và lưu thành công', async ({ page }) => {
      const query = uniqueQuery('qa edit');
      await createTerm(page, query);
      await findInGrid(page, query);
      await openEditFirstRow(page);
      await page.locator('input[name="synonym_for"]').fill('balm');
      await page.locator('input[name="popularity"]').fill('7');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expectSaved(page);
      await findInGrid(page, query);
      await expect(gridRows(page).first()).toContainText('balm');
      await expect(gridRows(page).first()).toContainText('7');
    });

    test('TC28 - Xoá Search Query ở form Edit rồi Save -> báo required', async ({ page }) => {
      await openEditFirstRow(page);
      await queryInput(page).fill('');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(page.getByRole('heading', { name: /Edit Search/ })).toBeVisible();
      await expect(page.getByText(/required/i).first()).toBeVisible();
    });

    test('TC29 - Reset ở form Edit khôi phục giá trị ban đầu', async ({ page }) => {
      await openEditFirstRow(page);
      const original = await queryInput(page).inputValue();
      await queryInput(page).fill('gia tri tam');
      await page.getByRole('button', { name: 'Reset' }).click();
      await expect(queryInput(page)).toHaveValue(original);
    });

    test('TC30 - Xoá search term do mình tạo', async ({ page }) => {
      const query = uniqueQuery('qa delete');
      await createTerm(page, query);
      await findInGrid(page, query);
      await openEditFirstRow(page);

      page.once('dialog', dialog => dialog.accept());
      await page.getByRole('button', { name: 'Delete' }).click();
      const confirmButton = page
        .locator('dialog[open] button, [role="dialog"] button')
        .filter({ hasText: /^(OK|Yes|Confirm|Delete)$/i })
        .first();
      if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) await confirmButton.click();

      await expect(page.locator('.success-msg, .messages .success').or(page.getByText(/(has been|was) deleted/i)).first()).toBeVisible({ timeout: 15000 });
      await gridQueryFilter(page).fill(query);
      await applyFilter(page);
      await expect(page.locator('#catalog_search_grid_table td.empty-text')).toHaveText(/No records found/i);
    });
  });
});