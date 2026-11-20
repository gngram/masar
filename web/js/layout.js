/**
 * Masar Universal Layout & InvenTree Architecture Engine
 * Manages the Collapsible Left Sidebar, InvenTree-Style Tabs, and Save/Load Customization Presets.
 */

const MasarLayout = {
  currentPreset: null,
  presets: [],
  categories: [],
  locations: [],

  init() {
    const token = typeof AuthState !== 'undefined' ? AuthState.getToken() : (localStorage.getItem('masar_token') || localStorage.getItem('qtrace_token'));
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const isLanding = currentPath === 'index.html' || currentPath === '';

    if (!token && isLanding) {
      return;
    }

    this.injectSidebar();
    this.injectCustomizerModal();
    this.loadCustomization();
    this.loadTrees();
  },

  injectSidebar() {
    const token = typeof AuthState !== 'undefined' ? AuthState.getToken() : (localStorage.getItem('masar_token') || localStorage.getItem('qtrace_token'));
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const isLanding = currentPath === 'index.html' || currentPath === '';
    if (!token && isLanding) return;

    const mainEl = document.querySelector('main');
    if (!mainEl || document.getElementById('masar-sidebar')) return;

    // Wrap main content
    const wrapper = document.createElement('div');
    wrapper.id = 'masar-layout-wrapper';

    const sidebar = document.createElement('aside');
    sidebar.id = 'masar-sidebar';
    sidebar.className = localStorage.getItem('masar_sidebar_collapsed') === 'true' ? 'collapsed' : '';

    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const urlParams = new URLSearchParams(window.location.search);
    const stageParam = urlParams.get('stage') || '';
    const tabParam = urlParams.get('tab') || '';
    const isStage = (k) => currentPath === 'stage.html' && stageParam === k;

    sidebar.innerHTML = `
      <!-- Sidebar Header / Brand & Toggle -->
      <div class="p-3 border-b border-gray-800 flex items-center justify-between text-xs text-gray-400">
        <div class="sidebar-label font-bold text-gray-200 tracking-wider flex items-center space-x-1.5 uppercase text-[11px]">
          <span>⚡</span>
          <span>InvenTree Engine</span>
        </div>
        <button onclick="MasarLayout.toggleSidebar()" class="p-1 hover:text-white rounded hover:bg-gray-800 transition-colors" title="Toggle Sidebar">
          ☰
        </button>
      </div>

      <!-- Quick Actions / Workspace Customizer -->
      <div class="p-2 border-b border-gray-800/80">
        <button onclick="MasarLayout.openCustomizer()" class="w-full sidebar-item bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/40 border border-indigo-500/30 font-bold py-1.5">
          <span class="sidebar-icon">🎨</span>
          <span class="sidebar-label">Customize View</span>
        </button>
      </div>

      <!-- Main Navigation Links -->
      <div class="py-2 flex-1 overflow-y-auto space-y-0.5 text-xs">
        <div class="sidebar-label px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
          Workspace
        </div>
        <a href="index.html" class="sidebar-item ${currentPath === 'index.html' || currentPath === '' ? 'active' : ''}">
          <span class="sidebar-icon">🏠</span><span class="sidebar-label">Main Hub</span>
        </a>
        <a href="dashboard.html" class="sidebar-item ${currentPath === 'dashboard.html' ? 'active' : ''}">
          <span class="sidebar-icon">📊</span><span class="sidebar-label">Dashboard</span>
        </a>
        <a href="parts.html" class="sidebar-item ${currentPath === 'parts.html' ? 'active' : ''}">
          <span class="sidebar-icon">🧩</span><span class="sidebar-label">Parts & BoM</span>
        </a>
        <a href="stock.html" class="sidebar-item ${currentPath === 'stock.html' ? 'active' : ''}">
          <span class="sidebar-icon">📦</span><span class="sidebar-label">Cleanroom Stock</span>
        </a>
        <a href="production.html" class="sidebar-item ${currentPath === 'production.html' ? 'active' : ''}">
          <span class="sidebar-icon">🏭</span><span class="sidebar-label">Production Status</span>
        </a>
        <a href="assembly.html" class="sidebar-item ${currentPath === 'assembly.html' ? 'active' : ''}">
          <span class="sidebar-icon">⚙️</span><span class="sidebar-label">Assembly Flow</span>
        </a>
        <a href="pipeline.html" class="sidebar-item ${currentPath === 'pipeline.html' ? 'active' : ''}">
          <span class="sidebar-icon">🔗</span><span class="sidebar-label">Pipeline Traceability</span>
        </a>
        <a href="procurement.html" class="sidebar-item ${currentPath === 'procurement.html' ? 'active' : ''}">
          <span class="sidebar-icon">📑</span><span class="sidebar-label">Procurement</span>
        </a>
        <a href="settings.html" class="sidebar-item ${currentPath === 'settings.html' ? 'active' : ''}">
          <span class="sidebar-icon">⚙️</span><span class="sidebar-label">Settings</span>
        </a>

        <!-- Manufacturing Units (The 7 Default Lifecycle Units) -->
        <div class="sidebar-label px-3 pt-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-t border-gray-800">
          Manufacturing Units
        </div>
        <a href="stage.html?stage=RECEIVE" class="sidebar-item ${isStage('RECEIVE') && tabParam !== 'procured' ? 'active' : ''}">
          <span class="sidebar-icon">📥</span><span class="sidebar-label">1. Receive</span>
        </a>
        <a href="stage.html?stage=INSPECT" class="sidebar-item ${isStage('INSPECT') ? 'active' : ''}">
          <span class="sidebar-icon">🔍</span><span class="sidebar-label">2. Inspect</span>
        </a>
        <a href="stage.html?stage=STORE_KIT" class="sidebar-item ${isStage('STORE_KIT') ? 'active' : ''}">
          <span class="sidebar-icon">📦</span><span class="sidebar-label">3. Store & Kit</span>
        </a>
        <a href="build.html" class="sidebar-item ${currentPath === 'build.html' || isStage('BUILD') ? 'active' : ''}">
          <span class="sidebar-icon">⚙️</span><span class="sidebar-label">4. Build</span>
        </a>
        <a href="stage.html?stage=TEST" class="sidebar-item ${isStage('TEST') ? 'active' : ''}">
          <span class="sidebar-icon">🔬</span><span class="sidebar-label">5. Test</span>
        </a>
        <a href="stage.html?stage=RELEASE" class="sidebar-item ${isStage('RELEASE') ? 'active' : ''}">
          <span class="sidebar-icon">🛡️</span><span class="sidebar-label">6. Release</span>
        </a>
        <a href="stage.html?stage=PACKAGE" class="sidebar-item ${isStage('PACKAGE') ? 'active' : ''}">
          <span class="sidebar-icon">🎁</span><span class="sidebar-label">7. Package</span>
        </a>
        <a href="stage.html?stage=RECEIVE&tab=procured" class="sidebar-item ${isStage('RECEIVE') && tabParam === 'procured' ? 'active' : ''}">
          <span class="sidebar-icon">📋</span><span class="sidebar-label">Procured Catalog</span>
        </a>

        <!-- InvenTree Dynamic Trees Section -->
        <div class="sidebar-tree-container mt-3 pt-3 border-t border-gray-800 space-y-1">
          <div class="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
            <span>Part Categories</span>
            <a href="parts.html" class="text-indigo-400 hover:text-indigo-300 font-mono text-[10px]">+</a>
          </div>
          <div id="sidebar-categories-tree" class="space-y-0.5">
            <span class="px-3 py-1 text-[10px] text-gray-400 block">Loading categories...</span>
          </div>

          <div class="px-3 pt-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
            <span>Storage Locations</span>
            <a href="stock.html" class="text-indigo-400 hover:text-indigo-300 font-mono text-[10px]">+</a>
          </div>
          <div id="sidebar-locations-tree" class="space-y-0.5">
            <span class="px-3 py-1 text-[10px] text-gray-400 block">Loading locations...</span>
          </div>
        </div>
      </div>

      <!-- Active Preset Footer -->
      <div class="p-3 border-t border-gray-800 text-[11px] text-gray-400 flex items-center justify-between">
        <div class="sidebar-label truncate">
          <span class="text-gray-400 block text-[9px] uppercase font-bold">Active Preset:</span>
          <span id="sidebar-active-preset-name" class="font-bold text-gray-200">Default Workspace</span>
        </div>
        <button onclick="MasarLayout.openCustomizer()" class="text-indigo-400 hover:text-indigo-300 text-xs" title="Preset Settings">⚙️</button>
      </div>
    `;

    mainEl.parentNode.insertBefore(wrapper, mainEl);
    wrapper.appendChild(sidebar);

    const mainContainer = document.createElement('div');
    mainContainer.id = 'masar-main-content';
    wrapper.appendChild(mainContainer);
    mainContainer.appendChild(mainEl);

    // Add Sidebar toggle button into global header if present
    const headerLeft = document.querySelector('header .flex.items-center.space-x-3');
    if (headerLeft && !document.getElementById('header-sidebar-toggle-btn')) {
      const toggleBtn = document.createElement('button');
      toggleBtn.id = 'header-sidebar-toggle-btn';
      toggleBtn.className = 'mr-2 p-1 text-gray-400 hover:text-white rounded hover:bg-gray-800 transition-colors text-base';
      toggleBtn.title = 'Toggle Left Sidebar (InvenTree Navigation)';
      toggleBtn.innerHTML = '☰';
      toggleBtn.onclick = () => MasarLayout.toggleSidebar();
      headerLeft.insertBefore(toggleBtn, headerLeft.firstChild);
    }
  },

  toggleSidebar() {
    const sidebar = document.getElementById('masar-sidebar');
    if (!sidebar) return;
    sidebar.classList.toggle('collapsed');
    const isCollapsed = sidebar.classList.contains('collapsed');
    localStorage.setItem('masar_sidebar_collapsed', isCollapsed ? 'true' : 'false');
  },

  async loadTrees() {
    try {
      // 1. Categories
      const catRes = await apiFetch('/parts/categories').catch(() => null);
      const catContainer = document.getElementById('sidebar-categories-tree');
      if (catContainer && catRes && catRes.success && Array.isArray(catRes.data)) {
        this.categories = catRes.data;
        catContainer.innerHTML = catRes.data.slice(0, 6).map(c => `
          <div onclick="window.location.href='parts.html?category=${c.id}'" class="tree-node truncate" title="${c.path}">
            <span class="mr-1.5 opacity-60">📁</span>
            <span class="truncate">${c.name}</span>
          </div>
        `).join('') || '<span class="px-3 text-[10px] text-gray-400">No categories</span>';
      }

      // 2. Locations
      const locRes = await apiFetch('/stock/locations').catch(() => null);
      const locContainer = document.getElementById('sidebar-locations-tree');
      if (locContainer && locRes && locRes.success && Array.isArray(locRes.data)) {
        this.locations = locRes.data;
        locContainer.innerHTML = locRes.data.slice(0, 5).map(l => `
          <div onclick="window.location.href='stock.html?location=${l.id}'" class="tree-node truncate" title="${l.path}">
            <span class="mr-1.5 opacity-60">📍</span>
            <span class="truncate">${l.name}</span>
          </div>
        `).join('') || '<span class="px-3 text-[10px] text-gray-400">No locations</span>';
      }
    } catch (e) {
      console.warn('Failed to load navigation trees:', e);
    }
  },

  async loadCustomization() {
    try {
      const res = await apiFetch('/customization/presets').catch(() => null);
      if (res && res.success && Array.isArray(res.data)) {
        this.presets = res.data;
        const active = res.data.find(p => p.is_active) || res.data[0];
        if (active) {
          this.applyPreset(active);
        }
      }
    } catch (e) {
      console.warn('Customization presets load error:', e);
    }
  },

  applyPreset(preset) {
    if (!preset) return;
    this.currentPreset = preset;

    const label = document.getElementById('sidebar-active-preset-name');
    if (label) label.innerText = preset.name;

    const config = preset.layout_config || {};
    
    // Apply Theme
    if (config.active_theme) {
      document.body.setAttribute('data-theme', config.active_theme);
    }

    // Apply Card Visibility on Hub if on index.html
    if (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/') || window.location.pathname === '') {
      this.applyHubCardVisibility(config);
    }
  },

  applyHubCardVisibility(config) {
    const visibleCards = config.visible_cards || ['admin', 'dashboard', 'production', 'stock', 'procurement', 'settings'];
    
    const cardMap = {
      'admin': document.getElementById('hub-admin-card'),
      'dashboard': document.querySelector('a[href="dashboard.html"]'),
      'production': document.querySelector('a[href="production.html"]'),
      'stock': document.querySelector('a[href="stock.html"]'),
      'procurement': document.querySelector('a[href="procurement.html"]'),
      'settings': document.querySelector('a[href="settings.html"]')
    };

    Object.keys(cardMap).forEach(key => {
      const el = cardMap[key];
      if (el) {
        if (visibleCards.includes(key)) {
          el.style.display = '';
        } else {
          el.style.display = 'none';
        }
      }
    });
  },

  injectCustomizerModal() {
    if (document.getElementById('masar-customizer-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'masar-customizer-modal';
    modal.className = 'fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[90vh]">
        <!-- Modal Header -->
        <div class="p-5 border-b border-gray-200 bg-slate-900 text-white flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <span class="text-xl">🎨</span>
            <div>
              <h3 class="font-bold text-sm">Workspace Customizer</h3>
              <p class="text-[11px] text-gray-400">Save and load customizable presets similar to InvenTree</p>
            </div>
          </div>
          <button onclick="MasarLayout.closeCustomizer()" class="text-gray-400 hover:text-white text-lg font-bold">✕</button>
        </div>

        <!-- Modal Body -->
        <div class="p-5 overflow-y-auto space-y-5 text-xs flex-1">
          <!-- Preset Switcher (Load Customization) -->
          <div class="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div class="flex items-center justify-between">
              <label class="font-bold text-gray-800 uppercase text-[10px] tracking-wider block">
                📂 Load Saved Preset
              </label>
              <button onclick="MasarLayout.exportPresetJSON()" class="text-[10px] text-indigo-600 hover:underline font-semibold">
                📥 Export JSON
              </button>
            </div>
            <div class="flex space-x-2">
              <select id="customizer-preset-select" class="flex-1 border border-gray-300 rounded-lg p-2 font-medium bg-white text-xs">
                <!-- Populated dynamically -->
              </select>
              <button onclick="MasarLayout.loadSelectedPreset()" class="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors">
                Apply
              </button>
            </div>
          </div>

          <!-- Visible Cards Configuration -->
          <div class="space-y-2">
            <label class="font-bold text-gray-800 uppercase text-[10px] tracking-wider block">
              🎛️ Main Hub Cards Visibility
            </label>
            <div class="grid grid-cols-2 gap-2" id="customizer-cards-toggles">
              <label class="customizer-card-pill cursor-pointer">
                <span class="font-medium text-gray-800">👑 Line Admin</span>
                <input type="checkbox" id="card-toggle-admin" class="rounded text-indigo-600">
              </label>
              <label class="customizer-card-pill cursor-pointer">
                <span class="font-medium text-gray-800">📊 Dashboard</span>
                <input type="checkbox" id="card-toggle-dashboard" class="rounded text-indigo-600" checked>
              </label>
              <label class="customizer-card-pill cursor-pointer">
                <span class="font-medium text-gray-800">🏭 Production Status</span>
                <input type="checkbox" id="card-toggle-production" class="rounded text-indigo-600" checked>
              </label>
              <label class="customizer-card-pill cursor-pointer">
                <span class="font-medium text-gray-800">📦 Cleanroom Stock</span>
                <input type="checkbox" id="card-toggle-stock" class="rounded text-indigo-600" checked>
              </label>
              <label class="customizer-card-pill cursor-pointer">
                <span class="font-medium text-gray-800">📑 Procurement</span>
                <input type="checkbox" id="card-toggle-procurement" class="rounded text-indigo-600" checked>
              </label>
              <label class="customizer-card-pill cursor-pointer">
                <span class="font-medium text-gray-800">⚙️ Settings & OIDC</span>
                <input type="checkbox" id="card-toggle-settings" class="rounded text-indigo-600" checked>
              </label>
            </div>
          </div>

          <!-- Theme Accent -->
          <div class="space-y-2">
            <label class="font-bold text-gray-800 uppercase text-[10px] tracking-wider block">
              ✨ Accent Theme
            </label>
            <select id="customizer-theme-select" class="w-full border border-gray-300 rounded-lg p-2 font-medium bg-white text-xs">
              <option value="dark-slate">Dark Slate (Masar Default)</option>
              <option value="emerald-tech">Emerald Tech (Cleanroom Style)</option>
              <option value="indigo-enterprise">Indigo Enterprise</option>
              <option value="cyber-amber">Cyber Amber</option>
            </select>
          </div>

          <!-- Save Current Customization Section -->
          <div class="p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-2.5">
            <label class="font-bold text-indigo-900 uppercase text-[10px] tracking-wider block">
              💾 Save Current Customization
            </label>
            <input type="text" id="customizer-save-name" placeholder="Preset Name (e.g. My Cleanroom Setup)" class="w-full border border-gray-300 rounded-lg p-2 text-xs">
            <input type="text" id="customizer-save-desc" placeholder="Brief description (optional)" class="w-full border border-gray-300 rounded-lg p-2 text-xs">
            <button onclick="MasarLayout.saveCurrentAsPreset()" class="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-colors">
              Save As New Preset
            </button>
          </div>

          <!-- Import JSON file -->
          <div class="flex items-center justify-between pt-2 border-t border-gray-200">
            <span class="text-gray-500 text-[11px]">Upload Preset File:</span>
            <input type="file" id="customizer-file-import" accept=".json" onchange="MasarLayout.importPresetJSON(event)" class="text-xs text-gray-500">
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="p-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-2">
          <button onclick="MasarLayout.closeCustomizer()" class="px-4 py-2 border border-gray-300 bg-white hover:bg-gray-100 font-semibold rounded-lg text-gray-700 text-xs">
            Done
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  },

  openCustomizer() {
    const modal = document.getElementById('masar-customizer-modal');
    if (!modal) return;
    
    // Populate dropdown
    const select = document.getElementById('customizer-preset-select');
    if (select) {
      select.innerHTML = this.presets.map(p => `
        <option value="${p.id}" ${p.is_active ? 'selected' : ''}>${p.name} ${p.is_active ? '(Active)' : ''}</option>
      `).join('');
    }

    // Populate current toggles
    const config = this.currentPreset?.layout_config || {};
    const visibleCards = config.visible_cards || ['admin', 'dashboard', 'production', 'stock', 'procurement', 'settings'];
    ['admin', 'dashboard', 'production', 'stock', 'procurement', 'settings'].forEach(id => {
      const cb = document.getElementById(`card-toggle-${id}`);
      if (cb) cb.checked = visibleCards.includes(id);
    });

    const themeSelect = document.getElementById('customizer-theme-select');
    if (themeSelect && config.active_theme) {
      themeSelect.value = config.active_theme;
    }

    modal.classList.remove('hidden');
  },

  closeCustomizer() {
    const modal = document.getElementById('masar-customizer-modal');
    if (modal) modal.classList.add('hidden');
  },

  async loadSelectedPreset() {
    const select = document.getElementById('customizer-preset-select');
    if (!select || !select.value) return;
    try {
      const res = await apiFetch(`/customization/presets/${select.value}/apply`, { method: 'POST' });
      if (res && res.success) {
        await this.loadCustomization();
        alert('Preset applied successfully!');
        this.closeCustomizer();
      }
    } catch (e) {
      alert('Failed to apply preset: ' + e.message);
    }
  },

  async saveCurrentAsPreset() {
    const nameInput = document.getElementById('customizer-save-name');
    const descInput = document.getElementById('customizer-save-desc');
    const name = nameInput?.value.trim();
    if (!name) {
      alert('Please enter a name for your preset');
      return;
    }

    const visibleCards = [];
    ['admin', 'dashboard', 'production', 'stock', 'procurement', 'settings'].forEach(id => {
      const cb = document.getElementById(`card-toggle-${id}`);
      if (cb && cb.checked) visibleCards.push(id);
    });

    const themeSelect = document.getElementById('customizer-theme-select');
    const activeTheme = themeSelect ? themeSelect.value : 'dark-slate';

    const layoutConfig = {
      visible_cards: visibleCards,
      card_order: visibleCards,
      active_theme: activeTheme,
      sidebar_collapsed: localStorage.getItem('masar_sidebar_collapsed') === 'true'
    };

    try {
      const res = await apiFetch('/customization/presets', {
        method: 'POST',
        body: {
          name: name,
          description: descInput ? descInput.value.trim() : '',
          is_active: true,
          layout_config: layoutConfig
        }
      });
      if (res && res.success) {
        alert(`Customization preset "${name}" saved and loaded!`);
        await this.loadCustomization();
        this.closeCustomizer();
      }
    } catch (e) {
      alert('Failed to save preset: ' + e.message);
    }
  },

  async exportPresetJSON() {
    try {
      const res = await apiFetch('/customization/export');
      if (res && res.success) {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res.data, null, 2));
        const dlAnchor = document.createElement('a');
        dlAnchor.setAttribute("href", dataStr);
        dlAnchor.setAttribute("download", `masar_preset_${Date.now()}.json`);
        document.body.appendChild(dlAnchor);
        dlAnchor.click();
        dlAnchor.remove();
      }
    } catch (e) {
      alert('Export failed: ' + e.message);
    }
  },

  importPresetJSON(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const payload = JSON.parse(e.target.result);
        const res = await apiFetch('/customization/import', {
          method: 'POST',
          body: payload
        });
        if (res && res.success) {
          alert('Preset imported successfully!');
          await this.loadCustomization();
          this.closeCustomizer();
        }
      } catch (err) {
        alert('Invalid preset JSON file: ' + err.message);
      }
    };
    reader.readAsText(file);
  }
};

// Initialize Layout on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  MasarLayout.init();
});
