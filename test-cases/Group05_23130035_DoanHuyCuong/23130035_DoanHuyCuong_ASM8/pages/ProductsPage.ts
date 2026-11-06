import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './Basepage';
import { ProductData } from '../test-data/testData';

export class ProductsPage extends BasePage {
  readonly grid: Locator;
  readonly rows: Locator;
  readonly emptyRow: Locator;

  constructor(page: Page) {
    super(page);
    this.grid = page.locator('#productGrid');
    // Dòng dữ liệu của Maho có thuộc tính title = URL trang edit
    this.rows = this.grid.locator('table.data tbody tr[title]');
    this.emptyRow = this.grid.locator('td.empty-text').first();
  }

  // ---------- Điều hướng ----------
  async open() {
    await this.goToMenu(/Catalog/i, /^\s*(Manage )?Products\s*$/i);
    await expect(this.grid).toBeVisible();
  }

  // ---------- Grid / filter (bộ lọc nằm trong tr.filter) ----------
  get filterName() { return this.grid.locator('tr.filter input[name="name"]').first(); }
  get filterSku() { return this.grid.locator('tr.filter input[name="sku"]').first(); }
  get filterStatus() { return this.grid.locator('tr.filter select[name="status"]').first(); }
  get filterType() { return this.grid.locator('tr.filter select[name="type"]').first(); }
  get limitSelect() { return this.grid.locator('select[name="limit"]').first(); }
  get searchBtn() { return this.button(/^\s*Search\s*$/i); }
  get resetBtn() { return this.button(/Reset Filter/i); }
  /** Trong Maho nút thêm sản phẩm có nhãn là "Add" */
  get addProductBtn() { return this.page.getByRole('button', { name: /^\s*Add\s*$/i }).first(); }
  /** Text dạng "123 items" ở thanh phân trang */
  get recordsFound() { return this.grid.getByText(/\d+\s+items?/i).first(); }

  columnHeader(name: string) {
    return this.grid.locator('thead tr.headings th').filter({ hasText: new RegExp(`^\\s*${name}\\s*$`, 'i') }).first();
  }

  async search(opts: { name?: string; sku?: string; status?: string; type?: string }) {
    if (opts.name !== undefined) await this.filterName.fill(opts.name);
    if (opts.sku !== undefined) await this.filterSku.fill(opts.sku);
    if (opts.status) {
      const value = /enab/i.test(opts.status) ? '1' : /disab/i.test(opts.status) ? '2' : '';
      await this.filterStatus.selectOption(value, { force: true });
    }
    if (opts.type) {
      // value của Type là: simple, configurable, virtual, bundle, grouped, downloadable...
      await this.filterType.selectOption(opts.type.toLowerCase().split(' ')[0], { force: true });
    }
    await this.searchBtn.click();
    await this.page.waitForLoadState('networkidle');
  }

  async resetFilter() {
    await this.resetBtn.click();
    await this.page.waitForLoadState('networkidle');
  }

  async sortBy(column: string) {
    await this.columnHeader(column).locator('a').first().click();
    await this.page.waitForLoadState('networkidle');
  }

  /** Lấy text của 1 cột; cột dạng icon (Status, Visibility) thì lấy từ thuộc tính title */
  async cellTexts(columnRegex: string): Promise<string[]> {
    const headers = await this.grid.locator('thead tr.headings th').allInnerTexts();
    const idx = headers.findIndex((h) => new RegExp(columnRegex, 'i').test(h));
    if (idx < 0) return [];
    const cells = this.rows.locator(`td:nth-child(${idx + 1})`);
    const n = await cells.count();
    const out: string[] = [];
    for (let i = 0; i < n; i++) {
      const cell = cells.nth(i);
      let text = (await cell.innerText()).trim();
      if (!text) text = ((await cell.locator('[title]').first().getAttribute('title').catch(() => '')) || '').trim();
      out.push(text);
    }
    return out;
  }

  // ---------- Tạo / sửa ----------
  async clickAddProduct() {
    await this.addProductBtn.click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  async continueCreate() {
    await this.button(/^\s*Continue\s*$/i).click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  async startNewSimpleProduct() {
    await this.clickAddProduct();
    await this.selectIfExists('#product_type, select[name="type"]', 'simple');
    await this.continueCreate();
  }

  async fillProduct(d: Partial<ProductData>) {
    await this.openTab(/^\s*General/i);
    if (d.name !== undefined) await this.fillIfExists('#name', d.name);
    if (d.description !== undefined) await this.fillIfExists('#description', d.description);
    if (d.shortDescription !== undefined) await this.fillIfExists('#short_description', d.shortDescription);
    if (d.sku !== undefined) await this.fillIfExists('#sku', d.sku);
    if (d.weight !== undefined) await this.fillIfExists('#weight', d.weight);
    // Chọn theo value để không phụ thuộc nhãn hiển thị: status 1 = Enabled, visibility 4 = Catalog, Search
    await this.selectIfExists('#status', '1');
    await this.selectIfExists('#visibility', '4');

    if (d.price !== undefined) {
      await this.openTab(/Prices/i);
      await this.fillIfExists('#price', d.price);
      await this.selectIfExists('#tax_class_id', '0');
    }
    if (d.qty !== undefined) {
      await this.openTab(/Inventory/i);
      await this.fillIfExists('#inventory_qty', d.qty);
    }
    const web = this.page.locator('input[id^="product_website_"]').first();
    if (await web.count()) {
      await this.openTab(/Websites/i);
      if (!(await web.isChecked())) await web.check({ force: true });
    }
  }

  /** Lưu và chờ kết quả: hoặc có thông báo (success/error), hoặc có validation-advice (lỗi client-side) */
  async save() {
    await this.button(/^\s*Save\s*$/i).click();
    await this.successMsg.first()
      .or(this.errorMsg.first())
      .or(this.page.locator('.validation-advice'))
      .first()
      .waitFor({ state: 'attached', timeout: 30_000 });
    await this.page.waitForLoadState('domcontentloaded');
  }

  /** Lỗi validate nằm trong tab đang ẩn nên KHÔNG dùng toBeVisible; kiểm tra theo id và nội dung */
  async expectFieldError(adviceId: string, text: RegExp) {
    const advice = this.page.locator(`#${adviceId}`);
    await expect(advice).toBeAttached();
    await expect(advice).toContainText(text);
    // Form chưa được lưu: vẫn ở trang /new
    await expect(this.page).toHaveURL(/catalog_product\/new/);
  }

  async saveAndContinue() {
    await this.button(/Save and Continue/i).click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  async createSimpleProduct(d: ProductData) {
    await this.startNewSimpleProduct();
    await this.fillProduct(d);
    await this.save();
  }

  /** Mở trang edit của dòng đầu tiên: lấy URL trong thuộc tính title rồi goto (click vào dòng không tự chuyển trang) */
  async openFirstRow() {
    const url = await this.rows.first().getAttribute('title');
    expect(url, 'Dòng đầu tiên không có URL').toBeTruthy();
    await this.page.goto(url!);
    await this.page.waitForLoadState('domcontentloaded');
  }

  async openProductBySku(sku: string) {
    await this.search({ sku });
    await this.openFirstRow();
  }

  async deleteCurrent() {
    this.acceptNextDialog();
    await this.button(/^\s*Delete\s*$/i).click();
    await this.successMsg.first().or(this.errorMsg.first()).waitFor({ state: 'visible', timeout: 30_000 });
  }

  async duplicateCurrent() {
    await this.button(/^\s*Duplicate\s*$/i).click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  // ---------- Mass action ----------
  get massActionSelect() { return this.page.locator('#productGrid_massaction-select'); }
  get massSubmitBtn() { return this.page.locator('#productGrid_massaction').getByRole('button', { name: /^\s*Submit\s*$/i }); }

  /** Bấm Submit mass action khi chưa chọn dòng nào và trả về nội dung hộp thoại alert */
  async submitMassActionWithoutSelection(): Promise<string> {
    await this.massActionSelect.selectOption({ index: 1 }, { force: true });
    let message = '';
    // alert chặn trang nên phải đăng ký xử lý TRƯỚC khi click (không dùng waitForEvent rồi mới click)
    this.page.once('dialog', async (dialog) => {
      message = dialog.message();
      await dialog.accept();
    });
    await this.massSubmitBtn.click();
    return message;
  }
}