import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './Basepage';
import { CategoryData } from '../test-data/testData';

/** Node cha mặc định. KHÔNG dùng node đầu tiên vì đó là "Root Catalog" (id=1): không thêm được subcategory và form khác */
export const DEFAULT_NODE = /Default Category/i;

export class CategoriesPage extends BasePage {
  readonly tree: Locator;
  readonly editContainer: Locator;

  constructor(page: Page) {
    super(page);
    this.tree = page.locator('#tree-div');
    this.editContainer = page.locator('#category-edit-container, #category_tab_content, .main-col-inner').first();
  }

  // ---------- Điều hướng ----------
  async open() {
    await this.goToMenu(/Catalog/i, /^\s*(Manage )?Categories\s*$/i);
    await expect(this.addSubBtn).toBeVisible({ timeout: 20_000 });
  }

  // ---------- Tree ----------
  /** Node trong cây (cây do maho-tree.js vẽ vào #tree-div, mỗi node có .label) */
  node(name: string | RegExp): Locator {
    return this.page.locator('#tree-div .label').filter({ hasText: name }).first();
  }
  get allNodes() {
    return this.page.locator('#tree-div li');
  }
  /** Số nhánh đang mở (thẻ <details open>) */
  get openFolders() {
    return this.page.locator('#tree-div details[open]');
  }
  get expandAllLink() { return this.page.getByText(/Expand All/i).first(); }
  get collapseAllLink() { return this.page.getByText(/Collapse All/i).first(); }

  /** Form danh mục được nạp bằng AJAX (POST catalog_category/edit|add) => chờ response, không dùng networkidle */
  private waitFormLoad(timeout = 30_000) {
    return this.page.waitForResponse(
      (r) => /catalog_category\/(edit|add)\b/.test(r.url()) && r.request().method() === 'POST',
      { timeout },
    );
  }

  async selectNode(name: string | RegExp) {
    const label = this.node(name);
    await label.waitFor({ state: 'visible' });
    // Nếu node đang được chọn thì Maho không gửi request mới => chỉ chờ ngắn
    const loaded = this.waitFormLoad(5_000).catch(() => null);
    await label.click();
    await loaded;
    // Response về trước khi DOM được thay => chờ ô Name đổi sang đúng danh mục đã chọn
    await expect(this.nameInput).toHaveValue(name);
  }

  // ---------- Nút chức năng ----------
  get addSubBtn() { return this.page.locator('#add_subcategory_button'); }
  get addRootBtn() { return this.page.locator('#add_root_category_button'); }
  get deleteBtn() { return this.page.getByRole('button', { name: /^\s*Delete\s*$/i }).first(); }
  get saveBtn() { return this.page.getByRole('button', { name: /^\s*Save\s*$/i }).first(); }
  get resetBtn() { return this.page.getByRole('button', { name: /^\s*Reset\s*$/i }).first(); }

  // ---------- Form ----------
  get nameInput() { return this.page.locator('[name="general[name]"]').first(); }
  get isActiveSelect() { return this.page.locator('[name="general[is_active]"]').first(); }
  get descriptionInput() { return this.page.locator('[name="general[description]"]').first(); }
  get urlKeyInput() { return this.page.locator('[name="general[url_key]"]').first(); }
  get metaTitleInput() { return this.page.locator('[name="general[meta_title]"]').first(); }
  get metaDescInput() { return this.page.locator('[name="general[meta_description]"]').first(); }

  async fillCategory(d: Partial<CategoryData> & { active?: 'Yes' | 'No' }) {
    await this.openTab(/General Information/i);
    if (d.name !== undefined) await this.nameInput.fill(d.name);
    if (d.active) await this.isActiveSelect.selectOption({ label: d.active });
    if (d.description !== undefined && (await this.descriptionInput.count())) {
      await this.descriptionInput.fill(d.description).catch(() => undefined);
    }
    if (d.urlKey !== undefined && (await this.urlKeyInput.count())) await this.urlKeyInput.fill(d.urlKey);
    if (d.metaTitle !== undefined && (await this.metaTitleInput.count())) await this.metaTitleInput.fill(d.metaTitle);
    if (d.metaDescription !== undefined && (await this.metaDescInput.count())) await this.metaDescInput.fill(d.metaDescription);
  }

  /** Lưu: submit AJAX (POST save) rồi form được nạp lại (POST edit). Nếu validate client-side lỗi thì không có request nào */
  async save() {
    const saved = this.page
      .waitForResponse((r) => /catalog_category\/save\b/.test(r.url()) && r.request().method() === 'POST', { timeout: 30_000 })
      .catch(() => null);
    const reloaded = this.waitFormLoad().catch(() => null);
    await this.saveBtn.click();
    const advice = this.page.locator('.validation-advice').first().waitFor({ state: 'attached', timeout: 30_000 }).then(() => 'advice').catch(() => null);
    const result = await Promise.race([saved.then((r) => (r ? 'saved' : null)), advice]);
    if (result === 'saved') await reloaded;
  }

  /** Thông báo lỗi dạng <ul><li> của Maho (vd "Category delete error: ...") */
  get anyMessage() { return this.page.locator('#messages li, .messages li').first(); }

  /** Chọn Root/node cha rồi Add Subcategory */
  async startSubcategory(parent: string | RegExp = DEFAULT_NODE) {
    await this.selectNode(parent);
    await expect(this.addSubBtn).toBeEnabled();
    await Promise.all([this.waitFormLoad(), this.addSubBtn.click()]);
    // Form cũ (Default Category) còn tồn tại tới khi DOM được thay => chờ form mới có Name rỗng
    await expect(this.nameInput).toHaveValue('');
  }

  async startRoot() {
    await Promise.all([this.waitFormLoad(), this.addRootBtn.click()]);
    await expect(this.nameInput).toHaveValue('');
  }

  async reset() {
    await Promise.all([this.waitFormLoad(), this.resetBtn.click()]);
  }

  async createSubcategory(d: CategoryData & { active?: 'Yes' | 'No' }, parent?: string | RegExp) {
    await this.startSubcategory(parent);
    await this.fillCategory(d);
    await this.save();
  }

  async deleteSelected() {
    this.acceptNextDialog();
    await Promise.all([
      this.page.waitForResponse((r) => /catalog_category\/delete\b/.test(r.url()), { timeout: 30_000 }),
      this.deleteBtn.click(),
    ]);
    await this.page.waitForLoadState('networkidle');
  }

  // ---------- Tab ----------
  async openDisplaySettings() { await this.openTab(/Display Settings/i); }
  async openCategoryProducts() { await this.openTab(/Category Products/i); }
  get categoryProductsGrid() { return this.page.locator('#catalog_category_products, [id^="catalog_category_products"]').first(); }
}