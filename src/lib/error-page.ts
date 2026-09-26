export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <title>تعذّر تحميل الصفحة | المنجز</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      * { box-sizing: border-box; }
      body { font: 15px/1.7 system-ui, -apple-system, sans-serif; background: #090d12; color: #f7fafc; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      .brand { color: #27e6a2; font-size: 2rem; font-weight: 900; margin-bottom: 1.25rem; }
      h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
      p { color: #aab5c0; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { padding: 0.5rem 1rem; border-radius: 0.375rem; font: inherit; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #27e6a2; color: #07110d; font-weight: 700; }
      .secondary { background: transparent; color: #f7fafc; border-color: #34414d; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="brand">مُنجِز</div>
      <h1>تعذّر تحميل الصفحة مؤقتاً</h1>
      <p>بياناتك وأرصدتك بأمان. أعد المحاولة، أو ارجع إلى الصفحة الرئيسية.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">إعادة المحاولة</button>
        <a class="secondary" href="/">الصفحة الرئيسية</a>
      </div>
    </div>
  </body>
</html>`;
}
