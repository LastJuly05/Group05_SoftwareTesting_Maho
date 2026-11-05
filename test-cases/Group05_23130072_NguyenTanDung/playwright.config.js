const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: '.',
  testMatch: '**/*Maho.spec.js', // chỉ chạy file Maho, bỏ qua spec Thiên Long cũ
  timeout: 120000,
  expect: { timeout: 15000 },
  workers: 1,            // site demo dùng chung -> chạy tuần tự
  fullyParallel: false,
  retries: 1,
  reporter: [['list'], ['./report-reporter.js', { outputFile: 'report.html' }]],
  use: {
    ...devices['Desktop Chrome'],
    locale: 'en-US',
    actionTimeout: 20000,
    navigationTimeout: 60000,
    screenshot: 'only-on-failure',
  },
});