/**
 * Masar Manufacturing Platform - Assembly Units Subsystem Page
 * Displays square cards in 4 columns for Receiver and Source sub-assemblies
 */

const AssemblyPage = {
  currentPU: null,
  currentSystem: 'RECEIVER', // 'RECEIVER' or 'SOURCE'
  systemSelected: false,
  stages: [],
  allStages: [],
  users: [],
  editingStage: null,

  init: async function() {
    const token = localStorage.getItem('masar_token') || localStorage.getItem('masar_auth_token') || localStorage.getItem('qtrace_token');
    if (!token) {
      window.location.href = 'index.html';
      return;
    }

    this.updateUserHeader();

    // Check system param in URL
    const urlParams = new URLSearchParams(window.location.search);
    const typeParam = urlParams.get('type') || urlParams.get('system');
    if (typeParam && (typeParam.toUpperCase() === 'SOURCE' || typeParam.toUpperCase() === 'RECEIVER')) {
      this.currentSystem = typeParam.toUpperCase();
      this.systemSelected = true;
    } else {
      this.systemSelected = false;
    }

    window.addEventListener('popstate', () => {
      const params = new URLSearchParams(window.location.search);
      const t = params.get('type') || params.get('system');
      if (t && (t.toUpperCase() === 'SOURCE' || t.toUpperCase() === 'RECEIVER')) {
        AssemblyPage.switchSystem(t.toUpperCase(), false);
      } else {
        AssemblyPage.showSystemSelectionView(false);
      }
    });

    try {
      await this.resolveActivePU();
      if (!this.currentPU) {
        showToast('No active Production Unit found. Redirecting...', 'error');
        setTimeout(() => { window.location.href = 'index.html'; }, 1500);
        return;
      }

      await this.loadAssemblyData();
    } catch (err) {
      console.error('Assembly init error:', err);
      const grid = document.getElementById('assembly-cards-grid');
      if (grid) {
        grid.innerHTML = `
          <div class="col-span-full p-8 bg-rose-50 border border-rose-200 rounded-2xl text-center text-rose-700 text-xs">
            <strong>Failed to initialize assembly units:</strong> ${err.message}
            <div class="mt-3">
              <button onclick="AssemblyPage.loadAssemblyData()" class="px-4 py-1.5 bg-rose-600 text-white rounded-lg font-bold">Retry</button>
            </div>
          </div>
        `;
      }
    }
  },

  isAdmin: function() {
    return localStorage.getItem('masar_user_is_server_admin') === 'true' || 
           localStorage.getItem('masar_is_server_admin') === 'true' ||
           (typeof AuthState !== 'undefined' && AuthState.isServerAdmin && AuthState.isServerAdmin());
  },

  updateUserHeader: function() {
    const name = localStorage.getItem('masar_user_full_name') || 'User';
    const isServerAdmin = localStorage.getItem('masar_user_is_server_admin') === 'true' || 
                          localStorage.getItem('masar_is_server_admin') === 'true' ||
                          (typeof AuthState !== 'undefined' && AuthState.isServerAdmin && AuthState.isServerAdmin());
    const nameEl = document.getElementById('header-user-name');
    const roleEl = document.getElementById('header-user-role');
    if (nameEl) nameEl.textContent = name;
    if (roleEl) roleEl.textContent = isServerAdmin ? '(Server Admin)' : '(Operator)';
  },

  signOut: function() {
    localStorage.removeItem('masar_auth_token');
    localStorage.removeItem('masar_token');
    localStorage.removeItem('masar_user');
    localStorage.removeItem('masar_user_email');
    localStorage.removeItem('masar_user_full_name');
    localStorage.removeItem('masar_user_roles');
    localStorage.removeItem('masar_user_is_server_admin');
    sessionStorage.removeItem('masar_active_tenant_pu_id');
    window.location.href = 'index.html';
  },

  resolveActivePU: async function() {
    const urlParams = new URLSearchParams(window.location.search);
    const puIdParam = urlParams.get('pu');
    const storedPuId = sessionStorage.getItem('masar_active_tenant_pu_id');

    const resp = await AuthAPI.getMyProductionUnits();
    const pus = resp.production_units || [];

    if (pus.length === 0) {
      throw new Error('You do not belong to any Production Unit.');
    }

    const targetId = puIdParam || storedPuId;
    if (targetId) {
      this.currentPU = pus.find(p => p.id === targetId) || pus[0];
    } else {
      this.currentPU = pus[0];
    }

    sessionStorage.setItem('masar_active_tenant_pu_id', this.currentPU.id);
  },

  loadAssemblyData: async function() {
    try {
      const [stagesResp, usersResp] = await Promise.all([
        AuthAPI.listAssemblyStages(this.currentPU.id, "ALL"),
        AuthAPI.listPUUsers(this.currentPU.id).catch(() => ({ users: [] }))
      ]);

      this.allStages = stagesResp.stages || [];
      this.users = usersResp.users || [];

      if (this.systemSelected) {
        this.switchSystem(this.currentSystem, false);
      } else {
        this.showSystemSelectionView(false);
      }
    } catch (err) {
      console.error('Failed to load assembly data:', err);
      const grid = document.getElementById('assembly-cards-grid');
      if (grid) {
        grid.innerHTML = `
          <div class="col-span-full p-8 bg-rose-50 border border-rose-200 rounded-2xl text-center text-rose-700 text-xs">
            <strong>Failed to load assembly units:</strong> ${err.message}
            <div class="mt-3">
              <button onclick="AssemblyPage.loadAssemblyData()" class="px-4 py-1.5 bg-rose-600 text-white rounded-lg font-bold">Retry</button>
            </div>
          </div>
        `;
      }
    }
  },

  selectSystem: function(system) {
    this.systemSelected = true;
    this.currentSystem = system;
    this.switchSystem(system, true);
  },

  showSystemSelectionView: function(updateUrl = true) {
    this.systemSelected = false;
    if (updateUrl) {
      const url = new URL(window.location);
      url.searchParams.delete('type');
      url.searchParams.delete('system');
      if (this.currentPU) {
        url.searchParams.set('pu', this.currentPU.id);
      }
      window.history.pushState({}, '', url);
    }
    const selContainer = document.getElementById('system-selection-container');
    const detContainer = document.getElementById('system-detail-container');
    if (selContainer) selContainer.classList.remove('hidden');
    if (detContainer) detContainer.classList.add('hidden');
  },

  switchSystem: function(system, updateUrl = true) {
    this.currentSystem = system;
    this.systemSelected = true;

    if (updateUrl) {
      const url = new URL(window.location);
      url.searchParams.set('type', system);
      if (this.currentPU) {
        url.searchParams.set('pu', this.currentPU.id);
      }
      window.history.pushState({ system }, '', url);
    }

    const selContainer = document.getElementById('system-selection-container');
    const detContainer = document.getElementById('system-detail-container');
    if (selContainer) selContainer.classList.add('hidden');
    if (detContainer) detContainer.classList.remove('hidden');

    // Filter stages for active system
    this.stages = (this.allStages || [])
      .filter(s => s.assembly_type === this.currentSystem)
      .sort((a, b) => (a.sequence_num || 0) - (b.sequence_num || 0));

    this.renderStagesGrid();
  },

  renderStagesGrid: function() {
    const grid = document.getElementById('assembly-cards-grid');
    if (!grid) return;

    if (this.stages.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-16 text-center text-gray-500 bg-white rounded-2xl border border-gray-200">
          <div class="text-3xl mb-2">🎛️</div>
          <h3 class="text-sm font-bold text-gray-800">No Sub-Assemblies Configured</h3>
          <p class="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            Sub-assemblies for ${this.currentSystem} are automatically initialized upon production unit setup.
          </p>
        </div>
      `;
      return;
    }

    const isAdmin = this.isAdmin();

    grid.innerHTML = this.stages.map((st, idx) => {
      const inputs = st.input_items || [];

      // Stage personnel
      const stageOperators = this.users.filter(u =>
        (u.roles || []).some(r => {
          const roleStr = typeof r === 'string' ? r : (r && r.role ? r.role : '');
          return roleStr.includes(`:${st.stage_key}`);
        })
      );

      const systemBadgeColor = this.currentSystem === 'RECEIVER'
        ? 'bg-teal-50 text-teal-800 border-teal-200'
        : 'bg-indigo-50 text-indigo-800 border-indigo-200';

      return `
        <div class="aspect-square bg-white border-2 border-gray-200 hover:border-indigo-500 rounded-2xl p-5 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between overflow-hidden group">
          <div>
            <!-- Header: Sequence & Stage Key -->
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center space-x-1.5">
                <span class="w-8 h-8 rounded-xl bg-slate-900 text-emerald-300 font-mono text-xs font-black flex items-center justify-center shadow-sm">
                  ${st.sequence_num || (idx + 1)}
                </span>
                <span class="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                  ${st.stage_key}
                </span>
              </div>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold border ${systemBadgeColor}">
                ${this.currentSystem}
              </span>
            </div>

            <!-- Title & Description -->
            <h3 class="text-sm font-black text-gray-900 group-hover:text-indigo-600 transition-colors mb-1 leading-snug">
              ${st.name}
            </h3>
            <p class="text-xs text-gray-500 line-clamp-2 leading-relaxed mb-2">
              ${st.description || 'Cleanroom sub-assembly integration step and hardware inspection.'}
            </p>

            <!-- Output Product -->
            <div class="p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs flex items-center justify-between">
              <span class="text-[11px] font-semibold text-gray-700 truncate max-w-[150px]" title="${st.output_product_name || 'Output Lot'}">
                📦 ${st.output_product_name || 'Subassembly Lot'}
              </span>
              <span class="font-mono text-[10px] font-bold bg-slate-200 px-1.5 py-0.5 rounded text-slate-800 shrink-0">
                ${st.output_product_code || 'LOT'}
              </span>
            </div>
          </div>

          <!-- Footer & Action Controls -->
          <div class="pt-3 border-t border-gray-100 space-y-2">
            <div class="flex items-center justify-between text-[11px] text-gray-600">
              <span class="font-bold text-gray-700">📦 ${inputs.length} BoM Items</span>
              <span class="text-gray-500">👥 ${stageOperators.length} Operators</span>
            </div>

            <div class="flex items-center gap-2">
              ${isAdmin ? `
                <button type="button" onclick="AssemblyPage.openBoMModal('${st.stage_key}')"
                        class="flex-1 py-1.5 px-2.5 bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white rounded-lg text-xs font-bold transition-all text-center flex items-center justify-center space-x-1 border border-indigo-200">
                  <span>🛠️</span><span>Define BoM</span>
                </button>
              ` : ''}
              <a href="stage.html?stage=${encodeURIComponent(st.stage_key)}&pu=${encodeURIComponent(this.currentPU.id)}"
                 class="flex-1 py-1.5 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all text-center flex items-center justify-center space-x-1 shadow-sm">
                <span>🔧</span><span>Operate</span>
              </a>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  openBoMModal: function(stageKey) {
    if (!this.isAdmin()) {
      showToast('Admin authority required to define or modify the Bill of Materials.', 'error');
      return;
    }

    const stage = this.allStages.find(s => s.stage_key === stageKey);
    if (!stage) return;

    this.editingStage = stage;

    const modal = document.getElementById('modal-define-bom');
    if (!modal) return;

    const nameEl = document.getElementById('modal-bom-stage-name');
    if (nameEl) nameEl.textContent = `${stage.name} (${stage.stage_key})`;

    const outNameEl = document.getElementById('modal-bom-outname');
    if (outNameEl) outNameEl.value = stage.output_product_name || '';

    const outCodeEl = document.getElementById('modal-bom-outcode');
    if (outCodeEl) outCodeEl.value = stage.output_product_code || '';

    const errEl = document.getElementById('modal-bom-error');
    if (errEl) errEl.classList.add('hidden');

    // Populate rows
    const tbody = document.getElementById('bom-items-table-body');
    if (tbody) {
      tbody.innerHTML = '';
      const items = stage.input_items || [];
      if (items.length === 0) {
        this.addBoMRow();
      } else {
        items.forEach(item => this.addBoMRow(item));
      }
    }

    modal.classList.remove('hidden');
  },

  closeBoMModal: function() {
    const modal = document.getElementById('modal-define-bom');
    if (modal) modal.classList.add('hidden');
    this.editingStage = null;
  },

  addBoMRow: function(item = null) {
    const tbody = document.getElementById('bom-items-table-body');
    if (!tbody) return;

    const tr = document.createElement('tr');
    tr.className = 'border-b border-gray-100 text-xs';

    const itemCode = item ? item.item_code || '' : '';
    const itemName = item ? item.item_name || '' : '';
    const quantity = item ? (item.quantity !== undefined ? item.quantity : 1) : 1;
    const unit = item ? item.unit || 'PCS' : 'PCS';
    const isSerialized = item ? item.is_serialized === true : false;

    tr.innerHTML = `
      <td class="py-2 px-3">
        <input type="text" name="bom-item-code" required value="${itemCode}" placeholder="OPT-1550"
               class="w-full px-2 py-1 text-xs border border-gray-300 rounded font-mono uppercase">
      </td>
      <td class="py-2 px-3">
        <input type="text" name="bom-item-name" required value="${itemName}" placeholder="Component Name"
               class="w-full px-2 py-1 text-xs border border-gray-300 rounded">
      </td>
      <td class="py-2 px-2 text-center">
        <input type="number" name="bom-item-qty" required min="1" max="9999" value="${quantity}"
               class="w-16 px-1.5 py-1 text-xs text-center border border-gray-300 rounded font-mono">
      </td>
      <td class="py-2 px-2">
        <select name="bom-item-unit" class="px-1.5 py-1 text-xs border border-gray-300 rounded bg-white">
          <option value="PCS" ${unit === 'PCS' ? 'selected' : ''}>PCS</option>
          <option value="SET" ${unit === 'SET' ? 'selected' : ''}>SET</option>
          <option value="KIT" ${unit === 'KIT' ? 'selected' : ''}>KIT</option>
          <option value="LOT" ${unit === 'LOT' ? 'selected' : ''}>LOT</option>
          <option value="UNIT" ${unit === 'UNIT' ? 'selected' : ''}>UNIT</option>
        </select>
      </td>
      <td class="py-2 px-2 text-center">
        <input type="checkbox" name="bom-item-serialized" ${isSerialized ? 'checked' : ''} class="rounded text-indigo-600 focus:ring-indigo-500">
      </td>
      <td class="py-2 px-2 text-center">
        <button type="button" onclick="this.closest('tr').remove()" class="p-1 text-gray-400 hover:text-rose-600 rounded">
          🗑️
        </button>
      </td>
    `;

    tbody.appendChild(tr);
  },

  saveBoM: async function(event) {
    if (event) event.preventDefault();
    if (!this.editingStage || !this.currentPU) return;

    if (!this.isAdmin()) {
      showToast('Admin authority required to define BoM.', 'error');
      return;
    }

    const outName = (document.getElementById('modal-bom-outname')?.value || '').trim();
    const outCode = (document.getElementById('modal-bom-outcode')?.value || '').trim().toUpperCase();
    const errEl = document.getElementById('modal-bom-error');
    const submitBtn = document.getElementById('btn-save-bom');

    if (errEl) errEl.classList.add('hidden');

    if (!outName || !outCode) {
      if (errEl) {
        errEl.textContent = 'Please specify both output product name and code.';
        errEl.classList.remove('hidden');
      }
      return;
    }

    const rows = document.querySelectorAll('#bom-items-table-body tr');
    const inputs = [];

    rows.forEach(tr => {
      const codeInp = tr.querySelector('input[name="bom-item-code"]');
      const nameInp = tr.querySelector('input[name="bom-item-name"]');
      const qtyInp = tr.querySelector('input[name="bom-item-qty"]');
      const unitSel = tr.querySelector('select[name="bom-item-unit"]');
      const serialInp = tr.querySelector('input[name="bom-item-serialized"]');

      const code = (codeInp?.value || '').trim().toUpperCase();
      const name = (nameInp?.value || '').trim();
      const qty = parseInt(qtyInp?.value || '1', 10);
      const unit = unitSel?.value || 'PCS';
      const isSerialized = serialInp ? serialInp.checked : false;

      if (code && name) {
        inputs.push({
          item_code: code,
          item_name: name,
          source: 'INVENTORY',
          quantity: qty,
          unit: unit,
          is_serialized: isSerialized,
          immutable_fields: isSerialized ? ['Serial Number'] : ['Lot Number']
        });
      }
    });

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving BoM...';
    }

    try {
      const config = {
        output_product_name: outName,
        output_product_code: outCode,
        input_items: inputs,
        intermediate_statuses: this.editingStage.intermediate_statuses || ['PENDING', 'IN_PROGRESS', 'CALIBRATING', 'QUALITY_CHECK', 'DONE']
      };

      await AuthAPI.updateStageConfig(this.currentPU.id, this.editingStage.id, config);
      showToast(`Bill of Materials for '${this.editingStage.name}' saved successfully.`, 'success');

      // Update in local cache
      this.editingStage.output_product_name = outName;
      this.editingStage.output_product_code = outCode;
      this.editingStage.input_items = inputs;

      const idx = this.allStages.findIndex(s => s.id === this.editingStage.id);
      if (idx !== -1) {
        this.allStages[idx] = { ...this.editingStage };
      }

      this.closeBoMModal();
      this.renderStagesGrid();
    } catch (err) {
      if (errEl) {
        errEl.textContent = err.message || 'Failed to update BoM.';
        errEl.classList.remove('hidden');
      }
      showToast('BoM update failed: ' + err.message, 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save BoM Configuration';
      }
    }
  }
};
