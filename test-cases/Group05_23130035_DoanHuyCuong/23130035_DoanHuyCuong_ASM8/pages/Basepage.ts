import { Page, Locator } from '@playwright/test';

export class BasePage {
  constructor(public readonly page: Page) {}

  get successMsg(): Locator {
    return this.page.locator('.success-msg, li.success-msg, .messages .success, .notice-msg.success');
  }
  get errorMsg(): Locator {
    return this.page.locator('.error-msg, li.error-msg, .messages .error');
  }
  get validationAdvice(): Locator {
    return this.page.locator('.validation-advice');
  }

  /** Đóng popup "System Messages" và chờ loading-mask biến mất (các lớp này chặn click) */
  async dismissPopups() {
    // Thử bấm nút đóng popup nếu có
    const closeBtn = this.page
      .locator('#message-popup-window a[title="close"], #message-popup-window .message-popup-head a, #message-popup-window button')
      .first();
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click({ force: true }).catch(() => undefined);
    }
    // Gỡ hẳn các lớp phủ còn sót lại để không chặn thao tác
    await this.page
      .evaluate(() => {
        ['message-popup-window-mask', 'message-popup-window'].forEach((id) => document.getElementById(id)?.remove());
      })
      .catch(() => undefined);
    // Chờ màn hình loading xong
    await this.page.locator('#loading-mask').waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => undefined);
  }

  /** Chèn CSS ẩn popup/loading-mask ở MỌI lần tải trang (gọi 1 lần trước khi goto) */
  async suppressOverlays() {
    await this.page.addInitScript(() => {
      const s = document.createElement('style');
      s.textContent =
        '#message-popup-window-mask,#message-popup-window,#loading-mask{display:none !important;pointer-events:none !important;}';
      document.documentElement.appendChild(s);
    });
  }

  /** Vào menu admin: lấy link của menu con rồi goto (không phụ thuộc hover, không bị lớp phủ chặn) */
  async goToMenu(parent: RegExp | string, child: RegExp | string) {
    const parentLink = this.page.locator('#nav > li > a').filter({ hasText: parent }).first();
    const childLink = parentLink.locator('xpath=..').locator('ul a').filter({ hasText: child }).first();
    const href = await childLink.getAttribute('href', { timeout: 15_000 });
    if (href && href !== '#') {
      await this.page.goto(href, { waitUntil: 'domcontentloaded' });
    } else {
      await parentLink.hover({ force: true });
      await childLink.click({ force: true });
    }
    await this.page.waitForLoadState('domcontentloaded');
  }

  button(name: RegExp | string): Locator {
    return this.page
      .getByRole('button', { name })
      .or(this.page.locator('button, input[type="button"], a.form-button').filter({ hasText: name }))
      .first();
  }

  /** Chấp nhận (hoặc huỷ) hộp thoại confirm của trình duyệt ở lần xuất hiện kế tiếp */
  acceptNextDialog() {
    this.page.once('dialog', (d) => d.accept());
  }
  dismissNextDialog() {
    this.page.once('dialog', (d) => d.dismiss());
  }

  async fillIfExists(selector: string, value: string) {
    const el = this.page.locator(selector).first();
    if (await el.count()) await el.fill(value);
  }

  async selectIfExists(selector: string, value: string | { label: string }) {
    const el = this.page.locator(selector).first();
    if (await el.count()) await el.selectOption(value as never);
  }

  /** Mở tab trong form edit (General, Prices, Inventory, ...) */
  async openTab(name: RegExp | string) {
    const tab = this.page.locator('[id$="info_tabs"] a, [id$="_tabs"] a, .tabs a, ul.tabs a, a.tab-item-link').filter({ hasText: name }).first();
    if (await tab.count()) await tab.click();
  }
}