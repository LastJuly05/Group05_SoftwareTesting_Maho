// Reporter tự viết: xuất 1 file report.html duy nhất (kèm ảnh chụp khi lỗi)
const fs = require('fs');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

class HtmlReporter {
  constructor(o = {}) { this.out = o.outputFile || 'report.html'; this.rows = new Map(); this.t0 = Date.now(); }
  onTestEnd(test, result) {
    const shot = result.attachments.find((a) => a.name === 'screenshot' && a.path);
    const st = result.status === 'passed' ? 'passed' : result.status === 'skipped' ? 'skipped' : 'failed';
    this.rows.set(test.id, {
      title: test.title, st, ms: result.duration,
      err: result.error ? (result.error.message || '').replace(/\u001b\[[0-9;]*m/g, '') : '',
      shot: shot ? fs.readFileSync(shot.path).toString('base64') : '',
    });
  }
  onEnd() {
    const r = [...this.rows.values()];
    const n = (s) => r.filter((x) => x.st === s).length;
    const body = r.map((x, i) => {
      const [id, ...rest] = x.title.split(': ');
      return `<tr class="${x.st}"><td>${i + 1}</td><td><b>${esc(id)}</b></td><td>${esc(rest.join(': '))}</td>
<td class="s">${x.st.toUpperCase()}</td><td>${(x.ms / 1000).toFixed(1)}s</td>
<td>${x.err ? `<pre>${esc(x.err.slice(0, 600))}</pre>` : ''}${x.shot ? `<img src="data:image/png;base64,${x.shot}" width="300">` : ''}</td></tr>`;
    }).join('\n');
    const html = `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><title>Maho - Automation Test Report</title>
<style>body{font-family:Segoe UI,Arial,sans-serif;margin:24px;color:#222}h1{margin:0 0 4px}
.sum{display:flex;gap:12px;margin:16px 0}.box{padding:12px 20px;border-radius:8px;color:#fff;font-size:18px}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:6px 8px;vertical-align:top;font-size:14px}
th{background:#333;color:#fff}tr.passed .s{color:#0a7d2c;font-weight:700}tr.failed{background:#fdecea}tr.failed .s{color:#c62828;font-weight:700}
pre{white-space:pre-wrap;margin:0;font-size:12px}</style></head><body>
<h1>Maho Commerce Demo - Automation Test Report</h1>
<div>Tester: Nguyễn Tấn Dũng (23130072) – Nhóm 5 | Công cụ: Playwright | Ngày chạy: ${new Date().toLocaleString('vi-VN')} | Thời gian: ${((Date.now() - this.t0) / 60000).toFixed(1)} phút</div>
<div class="sum"><div class="box" style="background:#555">Tổng: ${r.length}</div><div class="box" style="background:#2e7d32">Passed: ${n('passed')}</div>
<div class="box" style="background:#c62828">Failed: ${n('failed')}</div><div class="box" style="background:#f9a825">Skipped: ${n('skipped')}</div></div>
<table><tr><th>#</th><th>ID</th><th>Test case</th><th>Kết quả</th><th>Thời gian</th><th>Chi tiết lỗi</th></tr>
${body}</table></body></html>`;
    fs.writeFileSync(this.out, html, 'utf8');
    console.log(`\n>> Đã xuất báo cáo: ${this.out}`);
  }
}
module.exports = HtmlReporter;
