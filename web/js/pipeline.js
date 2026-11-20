/**
 * Masar Manufacturing Platform - Traceability Chain Page
 * Displays square cards in 4 columns for sequential manufacturing units
 */

const PipelinePage = {
  currentPU: null,
  stages: [],
  users: [],

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
        showToast('No active Production Unit selected. Redirecting to hub...', 'error');
        setTimeout(() => { window.location.href = 'index.html'; }, 1500);
        return;
      }

      await this.loadPipelineData();
    } catch (err) {
      console.error('Initialization error:', err);
      const grid = document.getElementById('pipeline-stages-grid');
      if (grid) {
        grid.innerHTML = `
          <div class="col-span-full p-8 bg-rose-50 border border-rose-200 rounded-2xl text-center text-rose-700 text-xs">
            <strong>Failed to initialize Traceability Chain:</strong> ${err.message}
            <div class="mt-3">
              <button onclick="PipelinePage.loadPipelineData()" class="px-4 py-1.5 bg-rose-600 text-white rounded-lg font-bold">Retry</button>
            </div>
          </div>
        `;
      }
    }
  },

  updateUserHeader: function() {
    const name = localStorage.getItem('masar_user_full_name') || 'Admin User';
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

  isAdmin: function() {
    return localStorage.getItem('masar_user_is_server_admin') === 'true' || 
           localStorage.getItem('masar_is_server_admin') === 'true' ||
           (typeof AuthState !== 'undefined' && AuthState.isServerAdmin && AuthState.isServerAdmin());
  },

  loadPipelineData: async function() {
    const grid = document.getElementById('pipeline-stages-grid');
    if (!grid) return;

    try {
      const [stagesResp, usersResp] = await Promise.all([
        AuthAPI.listPipelineStages(this.currentPU.id, "CHAIN"),
        AuthAPI.listPUUsers(this.currentPU.id).catch(() => ({ users: [] }))
      ]);

      let chainStages = (stagesResp.stages || []).filter(s => !s.assembly_type || s.assembly_type === 'CHAIN');
      if (chainStages.length === 0 && stagesResp.stages && stagesResp.stages.length > 0) {
        chainStages = stagesResp.stages.filter(s => !s.parent_stage_key || s.parent_stage_key === '');
      }
      this.stages = chainStages.sort((a, b) => (a.sequence_num || 0) - (b.sequence_num || 0));
      this.users = usersResp.users || [];

      this.renderStagesGrid();
    } catch (err) {
      grid.innerHTML = `
        <div class="col-span-full p-8 bg-rose-50 border border-rose-200 rounded-2xl text-center text-rose-700 text-xs">
          <strong>Failed to load Traceability Chain units:</strong> ${err.message}
          <div class="mt-3">
            <button onclick="PipelinePage.loadPipelineData()" class="px-4 py-1.5 bg-rose-600 text-white rounded-lg font-bold">Retry</button>
          </div>
        </div>
      `;
    }
  },

  renderStagesGrid: function() {
    const grid = document.getElementById('pipeline-stages-grid');
    if (!grid) return;

    if (this.stages.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-16 text-center text-gray-500 bg-white rounded-2xl border border-gray-200">
          <div class="text-3xl mb-2">⛓️</div>
          <h3 class="text-sm font-bold text-gray-800">No Traceability Units Initialized</h3>
          <p class="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            Traceability Chain units are automatically seeded on production unit creation.
          </p>
        </div>
      `;
      return;
    }

    grid.innerHTML = this.stages.map((st, idx) => {
      const isBuild = st.stage_key === 'BUILD';
      const isAssembly = st.stage_key === 'ASSEMBLY';

      const stageUsers = this.users.filter(u =>
        (u.roles || []).some(r => {
          const roleStr = typeof r === 'string' ? r : (r && r.role ? r.role : '');
          return roleStr.includes(`:${st.stage_key}`);
        })
      );

      const bomCount = (st.input_items && Array.isArray(st.input_items)) ? st.input_items.length : 0;
      const bomBadge = isAssembly || isBuild
        ? `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">📦 Sub-Assemblies</span>`
        : `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">📦 ${bomCount} BoM Item(s)</span>`;

      if (isBuild) {
        // Special square BUILD Card (Customizable Sub-Assemblies)
        return `
          <div onclick="PipelinePage.openBuildPage()"
               class="aspect-square bg-gradient-to-b from-amber-50/50 via-white to-white border-2 border-amber-400 hover:border-amber-500 rounded-2xl p-5 shadow-md hover:shadow-xl transition-all cursor-pointer group flex flex-col justify-between overflow-hidden">
            <div>
              <div class="flex items-center justify-between mb-2">
                <span class="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 font-mono text-xs font-black flex items-center justify-center shadow-sm">
                  ${st.sequence_num || 4}
                </span>
                <span class="px-2 py-0.5 rounded font-mono text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 uppercase">
                  BUILD
                </span>
              </div>

              <h3 class="text-sm font-black text-gray-900 group-hover:text-amber-700 transition-colors mb-1 leading-snug">
                ${st.name}
              </h3>
              <p class="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                Customizable multi-stage sub-assemblies and system integration.
              </p>
            </div>

            <div class="pt-2 border-t border-amber-200/60 space-y-2">
              <div class="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                Customizable Flow:
              </div>
              <div class="flex items-center justify-between text-xs font-bold text-amber-700 group-hover:text-amber-900">
                <span>Explore Sub-Assemblies</span>
                <span class="transform group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>
          </div>
        `;
      }

      if (isAssembly) {
        // Special square ASSEMBLY Card
        return `
          <div onclick="PipelinePage.openAssemblyPage()"
               class="aspect-square bg-gradient-to-b from-amber-50/50 via-white to-white border-2 border-amber-400 hover:border-amber-500 rounded-2xl p-5 shadow-md hover:shadow-xl transition-all cursor-pointer group flex flex-col justify-between overflow-hidden">
            <div>
              <div class="flex items-center justify-between mb-2">
                <span class="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 font-mono text-xs font-black flex items-center justify-center shadow-sm">
                  ${st.sequence_num || 4}
                </span>
                <span class="px-2 py-0.5 rounded font-mono text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 uppercase">
                  ASSEMBLY
                </span>
              </div>

              <h3 class="text-sm font-black text-gray-900 group-hover:text-amber-700 transition-colors mb-1 leading-snug">
                ${st.name}
              </h3>
              <p class="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                Sub-assembly & integration for Receiver (Bob) and Source (Alice).
              </p>
            </div>

            <div class="pt-2 border-t border-amber-200/60 space-y-2">
              <div class="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                Select Assembly System:
              </div>
              <div class="grid grid-cols-2 gap-2">
                <button type="button"
                        onclick="event.stopPropagation(); PipelinePage.openAssemblyPage('RECEIVER')"
                        class="px-2 py-1.5 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center justify-center space-x-1">
                  <span>📡</span><span>Receiver</span>
                </button>
                <button type="button"
                        onclick="event.stopPropagation(); PipelinePage.openAssemblyPage('SOURCE')"
                        class="px-2 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center justify-center space-x-1">
                  <span>💡</span><span>Source</span>
                </button>
              </div>
            </div>
          </div>
        `;
      }

      // Standard square Traceability Unit Card
      return `
        <div onclick="PipelinePage.openStageDetail('${st.stage_key}')"
             class="aspect-square bg-white border-2 border-gray-200 hover:border-indigo-500 rounded-2xl p-5 shadow-sm hover:shadow-xl transition-all cursor-pointer group flex flex-col justify-between overflow-hidden">
          <div>
            <div class="flex items-center justify-between mb-2">
              <span class="w-8 h-8 rounded-xl bg-slate-900 text-emerald-300 font-mono text-xs font-black flex items-center justify-center shadow-sm">
                ${st.sequence_num || (idx + 1)}
              </span>
              <span class="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                ${st.stage_key}
              </span>
            </div>

            <h3 class="text-sm font-black text-gray-900 group-hover:text-indigo-600 transition-colors mb-1 leading-snug">
              ${st.name}
            </h3>
            <p class="text-xs text-gray-500 line-clamp-3 leading-relaxed">
              ${st.description || 'Quality gate checklist and component inspections.'}
            </p>
          </div>

          <div class="pt-3 border-t border-gray-100 space-y-2">
            <div class="flex flex-wrap items-center gap-1">
              ${bomBadge}
              <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                👥 ${stageUsers.length}
              </span>
            </div>
            <div class="flex items-center justify-between text-xs font-bold text-indigo-600 group-hover:text-indigo-800">
              <span>Open Stage</span>
              <span class="transform group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  openBuildPage: function() {
    if (!this.currentPU) return;
    window.location.href = `build.html?pu=${encodeURIComponent(this.currentPU.id)}`;
  },

  openAssemblyPage: function(type) {
    if (!this.currentPU) return;
    const url = type 
      ? `assembly.html?pu=${encodeURIComponent(this.currentPU.id)}&type=${encodeURIComponent(type)}`
      : `assembly.html?pu=${encodeURIComponent(this.currentPU.id)}`;
    window.location.href = url;
  },

  openStageDetail: function(stageKey) {
    if (!this.currentPU || !stageKey) return;
    if (stageKey === 'BUILD') {
      this.openBuildPage();
      return;
    }
    if (stageKey === 'ASSEMBLY') {
      this.openAssemblyPage();
      return;
    }
    window.location.href = `stage.html?stage=${encodeURIComponent(stageKey)}&pu=${encodeURIComponent(this.currentPU.id)}`;
  }
};
