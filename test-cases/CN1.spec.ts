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

async function goToCmsPages(page: Page) {
  const cms = page.getByRole('link', { name: 'CMS', exact: true });
  await cms.hover();
  await cms.click();
  const pagesLink = page.getByRole('link', { name: 'Pages', exact: true }).first();
  if (!(await pagesLink.isVisible().catch(() => false))) await cms.hover();
  await pagesLink.click();
  await expect(page.getByRole('heading', { name: 'Manage Pages' })).toBeVisible();
}

async function openAddPage(page: Page) {
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByRole('heading', { name: 'New Page' })).toBeVisible();
}

async function openTab(page: Page, name: 'Page Information' | 'Content' | 'Design' | 'Meta Data') {
  await page.locator('#page_tabs').getByRole('link', { name, exact: true }).click();
}

async function fillContent(page: Page, text = 'Noi dung test tu dong') {
  await openTab(page, 'Content');
  await page.locator('input[name="content_heading"]').waitFor({ state: 'visible' });

  const iframe = page.locator('iframe[id$="_ifr"]');
  if (await iframe.count()) {
    const body = page.frameLocator('iframe[id$="_ifr"]').first().locator('body');
    await body.click();
    await body.fill(text);
    return;
  }

  const editable = page.locator('[contenteditable="true"]').first();
  if ((await editable.count()) && (await editable.isVisible().catch(() => false))) {
    await editable.click();
    await editable.fill(text);
    return;
  }

  await page.locator('textarea[name="content"]').evaluate((el, v) => {
    const ta = el as HTMLTextAreaElement;
    ta.value = v as string;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.dispatchEvent(new Event('change', { bubbles: true }));
  }, text);
}

async function expectSaved(page: Page) {
  const ok = page.locator('.success-msg, .messages .success').or(page.getByText(/has been saved/i));
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

const uniqueTitle = (prefix = 'QA Page') => `${prefix} ${Date.now()}`;

const titleInput = (p: Page) => p.locator('input[name="title"]').first();
const urlKeyInput = (p: Page) => p.locator('input[name="identifier"]').first();
const gridTitleFilter = (p: Page) => p.locator('#cmsPageGrid input[name="title"]');
const gridUrlKeyFilter = (p: Page) => p.locator('#cmsPageGrid input[name="identifier"]');
const gridRows = (p: Page) => p.locator('#cmsPageGrid_table tbody tr');
const gridPager = (p: Page) => p.locator('#cmsPageGrid td.pager');

test.describe('Maho Admin - CMS > Pages', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await closeIncomingMessage(page);
    await goToCmsPages(page);
  });

  test.describe('Grid - Manage Pages', () => {
    test('TC01 - Hiển thị đúng tiêu đề và nút Add', async ({ page }) => {
      await expect(page.getByRole('heading', { name: 'Manage Pages' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Add' })).toBeVisible();
    });

    test('TC02 - Grid hiển thị đủ các cột', async ({ page }) => {
      for (const col of ['Title', 'URL Key', 'Layout', 'Store View', 'Status', 'Date Created', 'Last Modified', 'Action']) {
        await expect(page.locator('#cmsPageGrid_table thead').getByText(col, { exact: true })).toBeVisible();
      }
    });

    test('TC03 - Grid có dữ liệu và hiển thị tổng số items', async ({ page }) => {
      await expect(gridPager(page).getByText(/\d+ items/)).toBeVisible();
      expect(await gridRows(page).count()).toBeGreaterThan(0);
    });

    test('TC04 - Mặc định 20 dòng mỗi trang', async ({ page }) => {
      await expect(page.locator('select[name="limit"]')).toHaveValue('20');
      expect(await gridRows(page).count()).toBeLessThanOrEqual(20);
    });

    test('TC05 - Đổi số dòng mỗi trang sang 50', async ({ page }) => {
      await page.locator('select[name="limit"]').selectOption('50');
      await expect(page.locator('select[name="limit"]')).toHaveValue('50');
      expect(await gridRows(page).count()).toBeLessThanOrEqual(50);
    });

    test('TC06 - Phân trang: sang trang 2', async ({ page }) => {
      const pageInput = page.locator('input[name="page"]');
      await pageInput.fill('2');
      await pageInput.press('Enter');
      await expect(pageInput).toHaveValue('2');
    });

    test('TC07 - Lọc theo Title', async ({ page }) => {
      await gridTitleFilter(page).fill('404');
      await page.getByRole('button', { name: 'Search' }).click();
      await expect(gridRows(page).first()).toContainText('404');
    });

    test('TC08 - Lọc theo URL Key', async ({ page }) => {
      await gridUrlKeyFilter(page).fill('no-route');
      await page.getByRole('button', { name: 'Search' }).click();
      await expect(gridRows(page).first()).toContainText('no-route');
    });

    test('TC09 - Lọc không có kết quả', async ({ page }) => {
      await gridTitleFilter(page).fill('zzz_khong_ton_tai_123');
      await page.getByRole('button', { name: 'Search' }).click();
      await expect(page.locator('#cmsPageGrid_table td.empty-text')).toHaveText(/No records found/i);
      await expect(gridPager(page).getByText(/\b0 items/)).toBeVisible();
    });

    test('TC10 - Reset Filter xoá bộ lọc', async ({ page }) => {
      await gridTitleFilter(page).fill('abc_filter');
      await page.getByRole('button', { name: 'Search' }).click();
      await page.getByRole('button', { name: 'Reset Filter' }).click();
      await expect(gridTitleFilter(page)).toHaveValue('');
    });

    test('TC11 - Sắp xếp theo cột Title', async ({ page }) => {
      const header = page.locator('#cmsPageGrid_table thead').getByText('Title', { exact: true });
      await header.click();
      await expect(gridRows(page).first()).toBeVisible();
      await header.click();
      await expect(gridRows(page).first()).toBeVisible();
    });

    test('TC12 - Lọc theo Status = Enabled', async ({ page }) => {
      await page.locator('#cmsPageGrid select[name="is_active"]').selectOption({ label: 'Enabled' });
      await page.getByRole('button', { name: 'Search' }).click();
      const statuses = await gridRows(page).locator('td:nth-child(5)').allTextContents();
      for (const s of statuses) expect(s.trim()).toBe('Enabled');
    });

    test('TC13 - Link Preview có trong mỗi dòng', async ({ page }) => {
      await expect(gridRows(page).first().getByRole('link', { name: 'Preview' })).toBeVisible();
    });
  });

  test.describe('Add New Page - UI', () => {
    test.beforeEach(async ({ page }) => {
      await openAddPage(page);
    });

    test('TC14 - Click Add mở form New Page với đủ nút', async ({ page }) => {
      await expect(page.getByRole('button', { name: /Back/ })).toBeVisible();
      for (const name of ['Reset', 'Save', 'Save and Continue']) {
        await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
      }
    });

    test('TC15 - Sidebar có đủ 4 tab', async ({ page }) => {
      for (const t of ['Page Information', 'Content', 'Design', 'Meta Data']) {
        await expect(page.locator('#page_tabs').getByRole('link', { name: t, exact: true })).toBeVisible();
      }
    });

    test('TC16 - Tab Page Information: field mặc định', async ({ page }) => {
      await expect(titleInput(page)).toBeVisible();
      await expect(urlKeyInput(page)).toBeVisible();
      await expect(page.getByText('Relative to Website Base URL')).toBeVisible();
      await expect(page.locator('select[name="is_active"]')).toHaveValue('1');
    });

    test('TC17 - Store View có All Store Views, Maho Store, Maison Maho', async ({ page }) => {
      const stores = page.locator('select[name="stores[]"]');
      await expect(stores).toContainText('All Store Views');
      await expect(stores).toContainText('English');
      await expect(stores).toContainText('Maison Maho');
      await expect(stores).toContainText('Voltline');
    });

    test('TC18 - Đổi Status sang Disabled', async ({ page }) => {
      await page.locator('select[name="is_active"]').selectOption({ label: 'Disabled' });
      await expect(page.locator('select[name="is_active"]')).toHaveValue('0');
    });

    test('TC19 - Tab Content: có Content Heading và editor toolbar', async ({ page }) => {
      await openTab(page, 'Content');
      await expect(page.locator('input[name="content_heading"]')).toBeVisible();
      await expect(page.locator('option', { hasText: 'Paragraph' }).first()).toBeAttached();
    });

    test('TC20 - Tab Design: Layout mặc định "1 column"', async ({ page }) => {
      await openTab(page, 'Design');
      await expect(page.getByText('Page Layout')).toBeVisible();
      await expect(page.locator('select[name="root_template"]')).toContainText('1 column');
      await expect(page.getByText('Custom Design').first()).toBeVisible();
    });

    test('TC21 - Tab Meta Data: Keywords, Description, Robots', async ({ page }) => {
      await openTab(page, 'Meta Data');
      await expect(page.locator('textarea[name="meta_keywords"]')).toBeVisible();
      await expect(page.locator('textarea[name="meta_description"]')).toBeVisible();
      await expect(page.locator('select[name="meta_robots"]')).toBeVisible();
    });

    test('TC22 - Nút Back quay lại Manage Pages', async ({ page }) => {
      await page.getByRole('button', { name: 'Back' }).click();
      await expect(page.getByRole('heading', { name: 'Manage Pages' })).toBeVisible();
    });

    test('TC23 - Nút Reset xoá dữ liệu đã nhập', async ({ page }) => {
      await titleInput(page).fill('Du lieu tam');
      await page.getByRole('button', { name: 'Reset' }).click();
      await expect(titleInput(page)).toHaveValue('');
    });
  });

  test.describe('Add New Page - Validation & Create', () => {
    test.beforeEach(async ({ page }) => {
      await openAddPage(page);
    });

    test('TC24 - Save khi để trống Page Title -> báo required', async ({ page }) => {
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(page.getByRole('heading', { name: 'New Page' })).toBeVisible();
      await expect(page.getByText(/required|URL key contains capital letters or disallowed symbols/i).first()).toBeVisible();
    });

    test('TC25 - Tạo page thành công với dữ liệu hợp lệ', async ({ page }) => {
      const title = uniqueTitle();
      await titleInput(page).fill(title);
      await urlKeyInput(page).fill(`qa-page-${Date.now()}`);
      await page.locator('select[name="stores[]"]').selectOption({ label: 'All Store Views' });

      await fillContent(page);

      await page.getByRole('button', { name: 'Save', exact: true }).click();

      await expectSaved(page);
      await gridTitleFilter(page).fill(title);
      await page.getByRole('button', { name: 'Search' }).click();
      await expect(gridRows(page).first()).toContainText(title);
    });

    test('TC26 - Save and Continue ở lại trang edit', async ({ page }) => {
      await titleInput(page).fill(uniqueTitle('QA Continue'));
      await urlKeyInput(page).fill(`qa-continue-${Date.now()}`);
      await page.locator('select[name="stores[]"]').selectOption({ label: 'All Store Views' });

      await fillContent(page);

      await page.getByRole('button', { name: 'Save and Continue' }).click();

      await expectSaved(page);
      await expect(page.getByRole('heading', { name: /Edit Page|QA Continue/ })).toBeVisible();
    });

    test('TC27 - Tạo page với đủ Content, Meta Data', async ({ page }) => {
      const title = uniqueTitle('QA Full');
      await titleInput(page).fill(title);
      await urlKeyInput(page).fill(`qa-full-${Date.now()}`);
      await page.locator('select[name="stores[]"]').selectOption({ label: 'All Store Views' });

      await fillContent(page, 'Noi dung day du de test');
      await page.locator('input[name="content_heading"]').fill('Heading test');

      await openTab(page, 'Meta Data');
      await page.locator('textarea[name="meta_keywords"]').fill('qa, playwright');
      await page.locator('textarea[name="meta_description"]').fill('Mo ta tu dong test');

      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expectSaved(page);
    });

    test('TC28 - Tạo page trùng URL Key cùng store -> báo lỗi', async ({ page }) => {
      await titleInput(page).fill(uniqueTitle('QA Dup'));
      await urlKeyInput(page).fill('no-route');
      await page.locator('select[name="stores[]"]').selectOption({ label: 'All Store Views' });

      await fillContent(page);

      await page.getByRole('button', { name: 'Save', exact: true }).click();
      const err = page.locator('.error-msg, .messages .error').or(page.getByText(/already exists/i));
      await expect(err.first()).toBeVisible({ timeout: 20000 });
    });
  });
});