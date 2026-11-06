import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './Basepage';

export class OrdersPage extends BasePage {
  readonly grid: Locator;
  readonly rows: Locator;
  readonly emptyRow: Locator;

  constructor(page: Page) {
    super(page);
    this.grid = page.locator('#sales_order_grid');
    // Dòng dữ liệu có thuộc tính title = URL trang chi tiết đơn
    this.rows = this.grid.locator('table.data tbody tr[title]');
    this.emptyRow = this.grid.locator('td.empty-text').first();
  }

  // ---------- Điều hướng ----------
  async open() {
    await this.goToMenu(/Sales/i, /^\s*(Manage )?Orders\s*$/i);
    await expect(this.grid).toBeVisible();
  }

  // ---------- Grid / filter ----------
  get filterOrderId() { return this.grid.locator('tr.filter input[name="real_order_id"]').first(); }
  get filterBillName() { return this.grid.locator('tr.filter input[name="billing_name"]').first(); }
  get filterShipName() { return this.grid.locator('tr.filter input[name="shipping_name"]').first(); }
  get filterStatus() { return this.grid.locator('tr.filter select[name="status"]').first(); }
  get filterDateFrom() { return this.grid.locator('input[name="created_at[from]"], input[id$="created_at_from"]').first(); }
  get filterDateTo() { return this.grid.locator('input[name="created_at[to]"], input[id$="created_at_to"]').first(); }
  get limitSelect() { return this.grid.locator('select[name="limit"]').first(); }
  get searchBtn() { return this.button(/^\s*Search\s*$/i); }
  get resetBtn() { return this.button(/Reset Filter/i); }
  get createOrderBtn() { return this.button(/Create New Order/i); }
  get exportSelect() { return this.page.locator('#sales_order_grid_export, select[name="export"]').first(); }
  get exportBtn() { return this.button(/^\s*Export\s*$/i); }
  get recordsFound() { return this.grid.getByText(/\d+\s+items?/i).first(); }

  columnHeader(name: string) {
    return this.grid.locator('thead tr.headings th').filter({ hasText: new RegExp(name, 'i') }).first();
  }

  async search(opts: { orderId?: string; billName?: string; shipName?: string; status?: string; from?: string; to?: string }) {
    if (opts.orderId !== undefined) await this.filterOrderId.fill(opts.orderId);
    if (opts.billName !== undefined) await this.filterBillName.fill(opts.billName);
    if (opts.shipName !== undefined) await this.filterShipName.fill(opts.shipName);
    if (opts.status) await this.filterStatus.selectOption({ label: opts.status });
    if (opts.from) await this.filterDateFrom.fill(opts.from);
    if (opts.to) await this.filterDateTo.fill(opts.to);
    await this.searchBtn.click();
    await this.page.waitForLoadState('networkidle');
  }

  async resetFilter() {
    await this.resetBtn.click();
    await this.page.waitForLoadState('networkidle');
  }

  async sortBy(column: string) {
    await Promise.all([
      this.page.waitForResponse((r) => /sales_order\/grid/i.test(r.url()), { timeout: 30_000 }),
      this.columnHeader(column).locator('a').first().click(),
    ]);
    await this.page.waitForLoadState('networkidle');
  }

  async columnValues(headerRegex: string): Promise<string[]> {
    const headers = await this.grid.locator('thead tr.headings th').allInnerTexts();
    const idx = headers.findIndex((h) => new RegExp(headerRegex, 'i').test(h));
    if (idx < 0) return [];
    return (await this.rows.locator(`td:nth-child(${idx + 1})`).allInnerTexts()).map((t) => t.trim());
  }

  // ---------- Chi tiết đơn ----------
  async openFirstOrder(): Promise<string> {
    const firstRow = this.rows.first();
    const url = await firstRow.getAttribute('title');
    const cells = await firstRow.locator('td').allInnerTexts();
    const headers = await this.grid.locator('thead tr.headings th').allInnerTexts();
    const idx = headers.findIndex((h) => /Order #/i.test(h));
    const orderNo = (cells[idx] || '').trim();
    await this.page.goto(url!);
    await this.page.waitForLoadState('domcontentloaded');
    return orderNo;
  }

  /** Mở đơn đầu tiên theo trạng thái, trả về false nếu không có */
  async openFirstOrderWithStatus(status: string): Promise<boolean> {
    await this.search({ status });
    if ((await this.rows.count()) === 0) return false;
    const url = await this.rows.first().getAttribute('title');
    await this.page.goto(url!);
    await this.page.waitForLoadState('domcontentloaded');
    return true;
  }

  get orderTitle() { return this.page.locator('.content-header h3, h3.icon-head, .head-sales-order').first(); }
  /** Khối thông tin trên trang chi tiết đơn là các heading (h4) */
  section(name: RegExp | string) { return this.page.getByRole('heading', { name }).first(); }
  get backBtn() { return this.button(/^\s*Back\s*$/i); }
  get holdBtn() { return this.button(/^\s*Hold\s*$/i); }
  get unholdBtn() { return this.button(/^\s*Unhold\s*$/i); }
  get cancelOrderBtn() { return this.button(/^\s*Cancel\s*$/i); }
  get invoiceBtn() { return this.button(/^\s*Invoice\s*$/i); }
  get shipBtn() { return this.button(/^\s*Ship\s*$/i); }
  get reorderBtn() { return this.button(/^\s*Reorder\s*$/i); }
  get editBtn() { return this.button(/^\s*Edit\s*$/i); }
  get commentBox() { return this.page.locator('#history_comment, textarea[name="history[comment]"]').first(); }
  // Trong Maho nút trên form comment chỉ có nhãn "Submit"
  get submitCommentBtn() { return this.page.getByRole('button', { name: /^\s*Submit( Comment)?\s*$/i }).first(); }

  async addComment(text: string) {
    await this.commentBox.fill(text);
    await this.submitCommentBtn.click();
  }

  // ---------- Mass action ----------
  get massActionSelect() { return this.page.locator('#sales_order_grid_massaction-select'); }
  get massSubmitBtn() { return this.page.locator('#sales_order_grid_massaction').getByRole('button', { name: /^\s*Submit\s*$/i }); }

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