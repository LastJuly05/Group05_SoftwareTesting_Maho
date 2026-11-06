import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './Basepage';
import { ADMIN } from '../test-data/testData';

export class LoginPage extends BasePage {
  readonly username: Locator;
  readonly password: Locator;
  readonly loginBtn: Locator;

  constructor(page: Page) {
    super(page);
    this.username = page.locator('#username, input[name="login[username]"]').first();
    this.password = page.locator('#login, input[name="login[password]"]').first();
    this.loginBtn = page.locator('input[type="submit"], button[type="submit"]').first();
  }

  /** Demo tự reset mỗi 3 giờ và hiện trang "Demo is resetting" (~1 phút): chờ rồi tải lại cho tới khi có form đăng nhập */
  async goto() {
    await this.suppressOverlays();
    const deadline = Date.now() + 75_000;
    while (true) {
      await this.page.goto(ADMIN.path).catch(() => undefined);
      if (await this.username.isVisible({ timeout: 5_000 }).catch(() => false)) return;
      const resetting = await this.page.getByText(/Demo is resetting/i).isVisible().catch(() => false);
      if (!resetting || Date.now() > deadline) return; // để bước fill báo lỗi rõ ràng
      await this.page.waitForTimeout(5_000);
    }
  }

  async login(user: string, pass: string) {
    await this.goto();
    await this.username.fill(user);
    await this.password.fill(pass);
    await this.loginBtn.click();
    await this.page.waitForLoadState('domcontentloaded');
  }

  async loginAsAdmin() {
    await this.login(ADMIN.username, ADMIN.password);
    await expect(this.username).toBeHidden({ timeout: 20_000 });
    await this.dismissPopups();
  }
}