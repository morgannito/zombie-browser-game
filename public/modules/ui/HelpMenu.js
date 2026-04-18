/**
 * HELP MENU
 * Displays keybindings overlay (H / F1). Includes AZERTY/QWERTY toggle
 * persisted in localStorage.
 * @module HelpMenu
 */

class HelpMenu {
  constructor() {
    this._visible = false;
    this._layout = localStorage.getItem('keyboardLayout') || 'qwerty';
    this._el = null;
    this._tableBody = null;
    this._layoutBtn = null;
    this._build();
    this._registerKeys();
  }

  _keybinds() {
    const up   = this._layout === 'azerty' ? 'Z' : 'W';
    const left = this._layout === 'azerty' ? 'Q' : 'A';
    return [
      ['Mouvement',       `${up} / ${left} / S / D  ou  Fleches`],
      ['Viser / Tirer',   'Souris'],
      ['Roue des armes',  'E'],
      ['Stats',           'Tab'],
      ['Recentrer camera','C'],
      ['Zoom minimap',    'X'],
      ['Mute audio',      'M'],
      ['Pause',           'Echap'],
      ['Debug FPS',       'F3'],
      ['Aide',            'H  /  F1'],
    ];
  }

  _build() {
    const el = document.createElement('div');
    el.id = 'help-menu';
    Object.assign(el.style, {
      display: 'none',
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%,-50%)',
      background: 'rgba(10,10,20,0.92)',
      border: '1px solid rgba(255,255,255,0.15)',
      borderRadius: '10px',
      padding: '24px 32px',
      color: '#e8e8e8',
      fontFamily: 'monospace',
      fontSize: '14px',
      minWidth: '360px',
      zIndex: '9999',
      boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
    });

    // Header
    const header = document.createElement('div');
    Object.assign(header.style, { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' });

    const title = document.createElement('span');
    title.textContent = 'Commandes';
    Object.assign(title.style, { fontSize: '16px', fontWeight: 'bold', letterSpacing: '1px' });

    const btn = document.createElement('button');
    Object.assign(btn.style, {
      background: 'rgba(255,255,255,0.1)',
      border: '1px solid rgba(255,255,255,0.25)',
      color: '#fff',
      padding: '4px 10px',
      borderRadius: '5px',
      cursor: 'pointer',
      fontFamily: 'monospace',
    });
    btn.addEventListener('click', () => this._toggleLayout());
    this._layoutBtn = btn;

    header.appendChild(title);
    header.appendChild(btn);

    // Table
    const table = document.createElement('table');
    table.style.borderCollapse = 'collapse';
    table.style.width = '100%';
    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
    this._tableBody = tbody;

    // Footer hint
    const hint = document.createElement('div');
    hint.textContent = 'Fermer : H ou F1 ou Echap';
    Object.assign(hint.style, { marginTop: '14px', color: '#555', textAlign: 'center', fontSize: '12px' });

    el.appendChild(header);
    el.appendChild(table);
    el.appendChild(hint);
    document.body.appendChild(el);
    this._el = el;

    this._renderRows();
  }

  _renderRows() {
    const layoutLabel = this._layout === 'azerty' ? 'AZERTY' : 'QWERTY';
    const altLabel    = this._layout === 'azerty' ? 'QWERTY' : 'AZERTY';
    this._layoutBtn.textContent = `${layoutLabel} -> ${altLabel}`;

    // Clear existing rows
    while (this._tableBody.firstChild) {
      this._tableBody.removeChild(this._tableBody.firstChild);
    }

    for (const [action, key] of this._keybinds()) {
      const tr = document.createElement('tr');

      const tdAction = document.createElement('td');
      tdAction.textContent = action;
      Object.assign(tdAction.style, { padding: '4px 16px 4px 0', color: '#aaa' });

      const tdKey = document.createElement('td');
      tdKey.textContent = key;
      Object.assign(tdKey.style, { color: '#fff', fontWeight: 'bold' });

      tr.appendChild(tdAction);
      tr.appendChild(tdKey);
      this._tableBody.appendChild(tr);
    }
  }

  _toggleLayout() {
    this._layout = this._layout === 'azerty' ? 'qwerty' : 'azerty';
    localStorage.setItem('keyboardLayout', this._layout);
    this._renderRows();
  }

  toggle() {
    this._visible ? this.hide() : this.show();
  }

  show() {
    this._visible = true;
    this._el.style.display = 'block';
  }

  hide() {
    this._visible = false;
    this._el.style.display = 'none';
  }

  _registerKeys() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const ae = document.activeElement;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
      if (e.key === 'h' || e.key === 'H' || e.key === 'F1') {
        e.preventDefault();
        this.toggle();
      }
      if (e.key === 'Escape' && this._visible) {
        this.hide();
      }
    });
  }
}

window.HelpMenu = HelpMenu;
