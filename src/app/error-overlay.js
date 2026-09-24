// Recoverable error screen. Never leaves the page blank. DOM built with textContent only.

let shown = false;

export function showErrorOverlay({ title = 'Something went wrong', message = '', detail = '', actions = null } = {}) {
  const existing = document.getElementById('error-overlay');
  if (existing) existing.remove();
  shown = true;
  const root = document.createElement('div');
  root.id = 'error-overlay';
  root.className = 'error-overlay';
  root.setAttribute('role', 'alertdialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'error-overlay-title');

  const card = document.createElement('div');
  card.className = 'error-card';
  const h = document.createElement('h1');
  h.id = 'error-overlay-title';
  h.textContent = title;
  const p = document.createElement('p');
  p.textContent = message || 'The game hit a problem it could not recover from on its own.';
  card.append(h, p);

  if (detail) {
    const pre = document.createElement('pre');
    pre.className = 'error-detail';
    pre.textContent = String(detail).slice(0, 4000);
    card.append(pre);
  }

  const row = document.createElement('div');
  row.className = 'error-actions';
  const list = actions || [
    { label: 'Reload game', primary: true, run: () => location.reload() },
    { label: 'Return to main menu', run: () => { location.href = location.pathname; } },
  ];
  for (const a of list) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = a.primary ? 'btn btn-primary' : 'btn';
    b.textContent = a.label;
    b.addEventListener('click', () => a.run());
    row.append(b);
  }
  card.append(row);
  root.append(card);
  document.body.append(root);
  const first = row.querySelector('button');
  if (first) first.focus();
  window.__GAME_ERROR__ = { title, message };
}

export function hideErrorOverlay() {
  const el = document.getElementById('error-overlay');
  if (el) el.remove();
  shown = false;
}

export function isErrorOverlayShown() { return shown; }
