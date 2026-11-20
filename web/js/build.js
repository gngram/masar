/**
 * Masar Manufacturing Platform - Build Unit & Sub-Assemblies Controller
 * Manages customizable sub-assemblies, BoM component sourcing (procured vs sub-assembly outputs),
 * parameter assignments, and non-admin navigation.
 */

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  const bg = type === 'error' ? 'bg-rose-600 text-white' : (type === 'success' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white');
  toast.className = `px-4 py-2.5 rounded-xl shadow-lg font-medium text-xs flex items-center space-x-2 transition-all duration-300 transform translate-y-2 opacity-0 ${bg}`;
  toast.innerHTML = `<span>${type === 'error' ? '⚠️' : (type === 'success' ? '✅' : 'ℹ️')}</span><span>${message}</span>`;
  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

const BuildPage = {
  currentPU: null,
  subAssemblies: [],
  parameters: [],
  procuredComponents: [],
  activeSubAssembly: null,

  init: async function() {
    const token = localStorage.getItem('masar_token') || localStorage.getItem('masar_auth_token') || localStorage.getItem('qtrace_token');
    if (!token) {
      window.location.href = 'index.html';
      return;
    }

    this.updateUserHeader();

    try {
      await this.resolveActivePU();
      if (!this.currentPU) {
        showToast('No active Production Unit found. Redirecting to hub...', 'error');
        setTimeout(() => { window.location.href = 'index.html'; }, 1500);
        return;
      }

      this.toggleAdminControls();
      await this.loadData();
    } catch (err) {
      console.error('BuildPage initialization error:', err);
      showToast('Failed to initialize Build console: ' + err.message, 'error');
    }
  },

  isAdmin: function() {
    return localStorage.getItem('masar_user_is_server_admin') === 'true' || 
           localStorage.getItem('masar_is_server_admin') === 'true' ||
           (typeof AuthState !== 'undefined' && AuthState.isServerAdmin && AuthState.isServerAdmin());
  },

  updateUserHeader: function() {
    const name = localStorage.getItem('masar_user_full_name') || 'Admin User';
    const isServerAdmin = this.isAdmin();
    const nameEl = document.getElementById('header-user-name');
    const roleEl = document.getElementById('header-user-role');
    if (nameEl) nameEl.textContent = name;
    if (roleEl) roleEl.textContent = isServerAdmin ? '(Server Admin)' : '(Operator)';
  },

  toggleAdminControls: function() {
    const isAdmin = this.isAdmin();
    const btnAdd = document.getElementById('btn-admin-add-sub');
    const btnParams = document.getElementById('btn-admin-params-catalog');
    if (btnAdd) {
      if (isAdmin) btnAdd.classList.remove('hidden');
      else btnAdd.classList.add('hidden');
    }
    if (btnParams) {
      if (isAdmin) btnParams.classList.remove('hidden');
      else btnParams.classList.add('hidden');
    }
  },

  signOut: function() {
    AuthState.clearSession();
    localStorage.removeItem('masar_auth_token');
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

    const breadcrumbPu = document.getElementById('breadcrumb-pu-name');
    if (breadcrumbPu) {
      breadcrumbPu.textContent = `${this.currentPU.code} - ${this.currentPU.name}`;
    }
  },

  loadData: async function() {
    try {
      const [subResp, paramsResp, procResp] = await Promise.all([
        AuthAPI.listSubAssemblies(this.currentPU.id),
        AuthAPI.listTrackingParameters(this.currentPU.id),
        AuthAPI.listProcuredComponents(this.currentPU.id)
      ]);

      this.subAssemblies = (subResp.sub_assemblies || []).sort((a, b) => (a.sequence_num || 0) - (b.sequence_num || 0));
      this.parameters = paramsResp.parameters || [];
      this.procuredComponents = procResp.components || [];

      this.renderMetrics();
      this.renderSubAssemblies();
    } catch (err) {
      console.error('Failed to load sub-assemblies data:', err);
      showToast('Error loading sub-assemblies: ' + err.message, 'error');
    }
  },

  renderMetrics: function() {
    const countEl = document.getElementById('metric-subassembly-count');
    const paramsEl = document.getElementById('metric-parameter-count');
    const procEl = document.getElementById('metric-procured-count');
    const wipEl = document.getElementById('metric-wip-count');
    const badgeCount = document.getElementById('badge-total-subassemblies');

    const totalWip = this.subAssemblies.reduce((acc, sa) => acc + (sa.wip_count || 0), 0);

    if (countEl) countEl.textContent = `${this.subAssemblies.length} Stages`;
    if (paramsEl) paramsEl.textContent = `${this.parameters.length} Defined`;
    if (procEl) procEl.textContent = `${this.procuredComponents.length} Parts`;
    if (wipEl) wipEl.textContent = `${totalWip} Units`;
    if (badgeCount) badgeCount.textContent = `${this.subAssemblies.length} Sub-Assemblies`;
  },

  renderSubAssemblies: function() {
    const grid = document.getElementById('subassemblies-grid');
    if (!grid) return;

    if (this.subAssemblies.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-16 text-center text-gray-500 bg-white rounded-2xl border border-gray-200">
          <div class="text-3xl mb-2">⚙️</div>
          <h3 class="text-sm font-bold text-gray-800">No Sub-Assemblies Defined</h3>
          <p class="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            Click "+ Add Sub-Assembly" to configure your modular assembly flow.
          </p>
        </div>
      `;
      return;
    }

    const isAdmin = this.isAdmin();

    grid.innerHTML = this.subAssemblies.map(sa => {
      const bomItems = sa.bom_inputs || [];
      const procuredCount = bomItems.filter(b => b.type === 'procured' || !b.type).length;
      const subOutputCount = bomItems.filter(b => b.type === 'subassembly_output').length;

      const assignedParams = sa.assigned_parameters || [];
      const paramBadges = assignedParams.slice(0, 3).map(k => {
        const found = this.parameters.find(p => p.param_key === k);
        const label = found ? found.name : k;
        return `<span class="inline-block px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-mono border border-slate-200 truncate max-w-[130px]" title="${label}">${label}</span>`;
      }).join('');
      const moreParams = assignedParams.length > 3 ? `<span class="text-[10px] text-gray-400 font-bold">+${assignedParams.length - 3}</span>` : '';

      return `
        <div class="bg-white border-2 border-amber-200/80 hover:border-amber-400 rounded-2xl p-5 shadow-sm hover:shadow-xl transition-all flex flex-col justify-between group">
          <div>
            <!-- Top Bar: Sequence + Stage Key -->
            <div class="flex items-center justify-between mb-2">
              <span class="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 font-mono text-xs font-black flex items-center justify-center shadow-sm">
                ${sa.sequence_num || 1}
              </span>
              <span class="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200 uppercase">
                ${sa.stage_key}
              </span>
            </div>

            <!-- Title & Description -->
            <h3 class="text-sm font-black text-gray-900 group-hover:text-amber-800 transition-colors mb-1 leading-snug">
              ${sa.name}
            </h3>
            <p class="text-xs text-gray-500 line-clamp-2 leading-relaxed mb-3">
              ${sa.description || 'Modular assembly station, precision alignment, and sub-assembly verification.'}
            </p>

            <!-- Output Product Box -->
            <div class="p-2.5 bg-amber-50/60 rounded-xl border border-amber-200/60 mb-3 text-xs">
              <div class="text-[9px] font-bold uppercase tracking-wider text-amber-800 mb-0.5 flex items-center space-x-1">
                <span>🎯 Output Product</span>
              </div>
              <div class="font-bold text-gray-900 truncate">
                ${sa.output_product_name || '<span class="text-gray-400 italic">No output defined</span>'}
              </div>
              <div class="text-[10px] font-mono font-semibold text-amber-700">
                ${sa.output_product_code || '--'}
              </div>
            </div>

            <!-- BoM Sourcing Breakdown -->
            <div class="mb-3 space-y-1 text-xs">
              <div class="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center justify-between">
                <span>BoM Sourcing:</span>
                <span class="font-mono text-gray-600">${bomItems.length} Part(s)</span>
              </div>
              <div class="flex flex-wrap gap-1">
                <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                  📥 ${procuredCount} Procured
                </span>
                <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                  ⚙️ ${subOutputCount} Sub-Output
                </span>
              </div>
            </div>

            <!-- Tracking Parameters Breakdown -->
            <div class="mb-3 space-y-1 text-xs">
              <div class="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center justify-between">
                <span>Assigned Parameters:</span>
                <span class="font-mono text-indigo-600 font-bold">${assignedParams.length} / ${this.parameters.length}</span>
              </div>
              <div class="flex flex-wrap items-center gap-1">
                ${paramBadges || '<span class="text-gray-400 italic text-[11px]">None assigned</span>'}
                ${moreParams}
              </div>
            </div>
          </div>

          <!-- Bottom Actions -->
          <div class="pt-3 border-t border-gray-100 space-y-2">
            <!-- Execution Link (Non-Admin & Admin) -->
            <a href="stage.html?stage=${encodeURIComponent(sa.stage_key)}&pu=${encodeURIComponent(this.currentPU.id)}"
               class="w-full py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center space-x-1.5">
              <span>🚀 Open Execution Console</span>
              <span>→</span>
            </a>

            ${isAdmin ? `
              <div class="grid grid-cols-3 gap-1 pt-1 text-[11px]">
                <button type="button" onclick="BuildPage.openBomModal('${sa.stage_key}')"
                        class="px-2 py-1 bg-white hover:bg-slate-50 border border-gray-200 text-gray-800 rounded-lg font-bold text-center"
                        title="Configure Bill of Materials">
                  📦 BoM
                </button>
                <button type="button" onclick="BuildPage.openParamsModal('${sa.stage_key}')"
                        class="px-2 py-1 bg-white hover:bg-slate-50 border border-gray-200 text-indigo-700 rounded-lg font-bold text-center"
                        title="Assign Tracking Parameters">
                  📊 Params
                </button>
                <button type="button" onclick="BuildPage.openEditSubAssemblyModal('${sa.stage_key}')"
                        class="px-2 py-1 bg-white hover:bg-slate-50 border border-gray-200 text-gray-700 rounded-lg font-bold text-center"
                        title="Edit Sub-Assembly">
                  ✏️ Edit
                </button>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  },

  // ==========================================
  // ADD / EDIT SUB-ASSEMBLY
  // ==========================================
  openAddSubAssemblyModal: function() {
    document.getElementById('modal-subassembly-title').innerHTML = '<span>⚙️</span><span>Add Sub-Assembly</span>';
    document.getElementById('sub-edit-key').value = '';
    document.getElementById('sub-name').value = '';
    document.getElementById('sub-key').value = '';
    document.getElementById('sub-key').disabled = false;
    document.getElementById('sub-sequence').value = this.subAssemblies.length + 1;
    document.getElementById('sub-desc').value = '';
    document.getElementById('sub-out-name').value = '';
    document.getElementById('sub-out-code').value = '';
    document.getElementById('modal-subassembly').classList.remove('hidden');
  },

  openEditSubAssemblyModal: function(stageKey) {
    const sa = this.subAssemblies.find(s => s.stage_key === stageKey);
    if (!sa) return;

    document.getElementById('modal-subassembly-title').innerHTML = `<span>✏️</span><span>Edit Sub-Assembly: ${sa.name}</span>`;
    document.getElementById('sub-edit-key').value = sa.stage_key;
    document.getElementById('sub-name').value = sa.name;
    document.getElementById('sub-key').value = sa.stage_key;
    document.getElementById('sub-key').disabled = true; // Key immutable on edit
    document.getElementById('sub-sequence').value = sa.sequence_num || 1;
    document.getElementById('sub-desc').value = sa.description || '';
    document.getElementById('sub-out-name').value = sa.output_product_name || '';
    document.getElementById('sub-out-code').value = sa.output_product_code || '';
    document.getElementById('modal-subassembly').classList.remove('hidden');
  },

  closeSubAssemblyModal: function() {
    document.getElementById('modal-subassembly').classList.add('hidden');
  },

  saveSubAssembly: async function(e) {
    e.preventDefault();
    const editKey = document.getElementById('sub-edit-key').value.trim();
    const name = document.getElementById('sub-name').value.trim();
    const key = document.getElementById('sub-key').value.trim().toUpperCase();
    const seq = parseInt(document.getElementById('sub-sequence').value, 10) || 1;
    const desc = document.getElementById('sub-desc').value.trim();
    const outName = document.getElementById('sub-out-name').value.trim();
    const outCode = document.getElementById('sub-out-code').value.trim().toUpperCase();

    try {
      if (editKey) {
        // Update
        await AuthAPI.updateSubAssembly(this.currentPU.id, editKey, {
          name: name,
          sequence_num: seq,
          description: desc,
          output_product_name: outName,
          output_product_code: outCode
        });
        showToast(`Sub-assembly '${name}' updated successfully!`, 'success');
      } else {
        // Create
        await AuthAPI.createSubAssembly(this.currentPU.id, {
          stage_key: key,
          name: name,
          sequence_num: seq,
          description: desc,
          output_product_name: outName,
          output_product_code: outCode,
          bom_inputs: [],
          assigned_parameters: ["mechanical_torque", "esd_safe_check"]
        });
        showToast(`Sub-assembly '${name}' created successfully!`, 'success');
      }

      this.closeSubAssemblyModal();
      await this.loadData();
    } catch (err) {
      console.error('Save sub-assembly error:', err);
      showToast('Error saving sub-assembly: ' + err.message, 'error');
    }
  },

  // ==========================================
  // CONFIGURE BoM MODAL
  // ==========================================
  openBomModal: function(stageKey) {
    this.activeSubAssembly = this.subAssemblies.find(s => s.stage_key === stageKey);
    if (!this.activeSubAssembly) return;

    document.getElementById('modal-bom-sub-name').textContent = `Sub-Assembly: ${this.activeSubAssembly.name} (${this.activeSubAssembly.stage_key})`;
    this.onBomSourceTypeChange();
    this.renderBomItemsTable();
    document.getElementById('modal-bom').classList.remove('hidden');
  },

  closeBomModal: function() {
    document.getElementById('modal-bom').classList.add('hidden');
    this.activeSubAssembly = null;
  },

  onBomSourceTypeChange: function() {
    const type = document.getElementById('bom-source-type').value;
    const select = document.getElementById('bom-component-select');
    if (!select) return;

    if (type === 'procured') {
      // Externally procured parts (from Receive / Store & Kit)
      select.innerHTML = this.procuredComponents.map(c => `
        <option value="${c.item_code}" data-name="${c.name}" data-unit="${c.unit || 'PCS'}">
          [Procured] ${c.item_code} - ${c.name} (${c.supplier || 'Vendor'})
        </option>
      `).join('');
    } else {
      // Upstream sub-assembly outputs
      const earlierSubs = this.subAssemblies.filter(s =>
        s.stage_key !== (this.activeSubAssembly && this.activeSubAssembly.stage_key) &&
        s.output_product_code
      );

      if (earlierSubs.length === 0) {
        select.innerHTML = `<option value="">No earlier sub-assembly outputs available</option>`;
      } else {
        select.innerHTML = earlierSubs.map(s => `
          <option value="${s.output_product_code}" data-name="${s.output_product_name}" data-unit="PCS" data-source="${s.stage_key}">
            [Sub-Assembly Output] ${s.output_product_code} - ${s.output_product_name} (from ${s.name})
          </option>
        `).join('');
      }
    }
  },

  addBomItem: async function() {
    if (!this.activeSubAssembly) return;

    const type = document.getElementById('bom-source-type').value;
    const select = document.getElementById('bom-component-select');
    const selectedOpt = select.options[select.selectedIndex];
    if (!selectedOpt || !selectedOpt.value) {
      showToast('Please select a valid component to add.', 'error');
      return;
    }

    const itemCode = selectedOpt.value;
    const name = selectedOpt.getAttribute('data-name') || itemCode;
    const unit = document.getElementById('bom-unit').value.trim() || 'PCS';
    const qty = parseFloat(document.getElementById('bom-quantity').value) || 1;
    const sourceStage = selectedOpt.getAttribute('data-source') || '';

    const currentBom = this.activeSubAssembly.bom_inputs || [];
    // Check if item already in BoM
    const existingIndex = currentBom.findIndex(b => b.item_code === itemCode);
    if (existingIndex >= 0) {
      currentBom[existingIndex].quantity = qty;
      currentBom[existingIndex].unit = unit;
    } else {
      currentBom.push({
        type: type,
        item_code: itemCode,
        name: name,
        quantity: qty,
        unit: unit,
        source_stage_key: sourceStage
      });
    }

    try {
      await AuthAPI.updateSubAssembly(this.currentPU.id, this.activeSubAssembly.stage_key, {
        bom_inputs: currentBom
      });
      this.activeSubAssembly.bom_inputs = currentBom;
      this.renderBomItemsTable();
      this.renderSubAssemblies();
      showToast(`Component '${name}' added to BoM!`, 'success');
    } catch (err) {
      console.error('Error adding BoM item:', err);
      showToast('Error saving BoM item: ' + err.message, 'error');
    }
  },

  deleteBomItem: async function(itemCode) {
    if (!this.activeSubAssembly) return;
    const updated = (this.activeSubAssembly.bom_inputs || []).filter(b => b.item_code !== itemCode);

    try {
      await AuthAPI.updateSubAssembly(this.currentPU.id, this.activeSubAssembly.stage_key, {
        bom_inputs: updated
      });
      this.activeSubAssembly.bom_inputs = updated;
      this.renderBomItemsTable();
      this.renderSubAssemblies();
      showToast('BoM item removed.', 'info');
    } catch (err) {
      console.error('Error removing BoM item:', err);
      showToast('Error deleting BoM item: ' + err.message, 'error');
    }
  },

  renderBomItemsTable: function() {
    const tbody = document.getElementById('bom-items-table-body');
    const badge = document.getElementById('bom-items-count-badge');
    if (!tbody || !this.activeSubAssembly) return;

    const items = this.activeSubAssembly.bom_inputs || [];
    if (badge) badge.textContent = `${items.length} Items`;

    if (items.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="py-6 text-center text-gray-400">
            No components added to this sub-assembly's BoM yet. Use the selector above to add externally procured parts or upstream sub-assembly outputs.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = items.map(item => {
      const isProcured = item.type === 'procured' || !item.type;
      const originBadge = isProcured
        ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-800 border border-teal-300">📥 Procured (Store & Kit)</span>`
        : `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-300">⚙️ Output: ${item.source_stage_key || 'Sub-Assembly'}</span>`;

      return `
        <tr class="hover:bg-slate-50 transition-colors">
          <td class="py-2.5 px-3 font-mono font-bold text-gray-900">${item.item_code}</td>
          <td class="py-2.5 px-3 font-medium text-gray-900">${item.name}</td>
          <td class="py-2.5 px-3">${originBadge}</td>
          <td class="py-2.5 px-3 text-center font-mono font-bold text-gray-700">${item.quantity} ${item.unit || 'PCS'}</td>
          <td class="py-2.5 px-3 text-right">
            <button onclick="BuildPage.deleteBomItem('${item.item_code}')"
                    class="px-2 py-1 text-rose-600 hover:text-white hover:bg-rose-600 border border-rose-200 rounded text-xs font-semibold transition-all">
              Delete
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  // ==========================================
  // ASSIGN TRACKING PARAMETERS MODAL
  // ==========================================
  openParamsModal: function(stageKey) {
    this.activeSubAssembly = this.subAssemblies.find(s => s.stage_key === stageKey);
    if (!this.activeSubAssembly) return;

    document.getElementById('modal-params-sub-name').textContent = `Assign Tracking Parameters to: ${this.activeSubAssembly.name} (${this.activeSubAssembly.stage_key})`;

    const grid = document.getElementById('params-checkbox-grid');
    if (!grid) return;

    const assigned = new Set(this.activeSubAssembly.assigned_parameters || []);

    grid.innerHTML = this.parameters.map(p => {
      const isChecked = assigned.has(p.param_key);
      return `
        <label class="flex items-start space-x-2.5 p-2 rounded-lg border border-gray-200 hover:bg-slate-50 cursor-pointer transition-colors ${isChecked ? 'bg-indigo-50/50 border-indigo-200' : ''}">
          <input type="checkbox" value="${p.param_key}" ${isChecked ? 'checked' : ''}
                 onchange="BuildPage.updateParamCountBadge()"
                 class="param-checkbox mt-0.5 rounded text-indigo-600 focus:ring-indigo-500">
          <div class="flex-1">
            <div class="font-bold text-gray-900 flex items-center justify-between">
              <span>${p.name}</span>
              ${p.unit ? `<span class="text-[10px] text-gray-400 font-mono">(${p.unit})</span>` : ''}
            </div>
            <div class="text-[10px] text-gray-500 flex items-center space-x-2 mt-0.5">
              <span class="font-mono text-indigo-700">${p.param_key}</span>
              <span>•</span>
              <span class="font-semibold text-gray-600">${p.data_type}</span>
              ${p.is_critical ? '<span class="px-1 py-0.2 rounded bg-rose-100 text-rose-800 text-[9px] font-bold">CRITICAL</span>' : ''}
            </div>
          </div>
        </label>
      `;
    }).join('');

    this.updateParamCountBadge();
    document.getElementById('modal-params').classList.remove('hidden');
  },

  updateParamCountBadge: function() {
    const checked = document.querySelectorAll('.param-checkbox:checked').length;
    const badge = document.getElementById('params-selected-count');
    if (badge) {
      badge.textContent = `${checked} of ${this.parameters.length} Parameters Assigned`;
    }
  },

  closeParamsModal: function() {
    document.getElementById('modal-params').classList.add('hidden');
    this.activeSubAssembly = null;
  },

  saveAssignedParameters: async function() {
    if (!this.activeSubAssembly) return;

    const checkboxes = document.querySelectorAll('.param-checkbox:checked');
    const selectedKeys = Array.from(checkboxes).map(cb => cb.value);

    try {
      await AuthAPI.setStageParameters(this.currentPU.id, this.activeSubAssembly.stage_key, selectedKeys);
      this.activeSubAssembly.assigned_parameters = selectedKeys;
      this.renderSubAssemblies();
      this.closeParamsModal();
      showToast(`Assigned ${selectedKeys.length} parameter(s) to ${this.activeSubAssembly.name}!`, 'success');
    } catch (err) {
      console.error('Error assigning parameters:', err);
      showToast('Error saving assigned parameters: ' + err.message, 'error');
    }
  },

  // ==========================================
  // GLOBAL PARAMETER CATALOG MODAL
  // ==========================================
  openParamsCatalogModal: function() {
    const tbody = document.getElementById('catalog-parameters-table-body');
    if (!tbody) return;

    tbody.innerHTML = this.parameters.map(p => `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="py-2.5 px-3 font-mono font-bold text-indigo-700">${p.param_key}</td>
        <td class="py-2.5 px-3 font-medium text-gray-900">${p.name}</td>
        <td class="py-2.5 px-3 font-mono text-gray-700">${p.unit || '--'}</td>
        <td class="py-2.5 px-3 font-semibold text-gray-600">${p.data_type}</td>
        <td class="py-2.5 px-3 font-mono text-gray-600">${p.default_value || '--'}</td>
        <td class="py-2.5 px-3 text-center">
          ${p.is_critical ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">YES</span>' : '<span class="text-gray-400">NO</span>'}
        </td>
      </tr>
    `).join('');

    document.getElementById('modal-catalog').classList.remove('hidden');
  },

  closeParamsCatalogModal: function() {
    document.getElementById('modal-catalog').classList.add('hidden');
  }
};
