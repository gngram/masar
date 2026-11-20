/**
 * Masar Settings & Baseline Controller
 * Manages OIDC parameters, dev bypass tokens, and active engineering baselines
 */

async function loadSettings() {
  try {
    const res = await SettingsAPI.getSettings();
    if (!res.success) return;
    const d = res.data;

    const elOidcProvider = document.getElementById('settings-oidc-provider');
    const elIssuerUrl = document.getElementById('settings-issuer-url');
    const elClientId = document.getElementById('settings-client-id');
    const elBypassBadge = document.getElementById('settings-bypass-badge');
    const elRepoUrl = document.getElementById('settings-repo-url');
    const elBaselinesList = document.getElementById('settings-baselines-list');

    if (elOidcProvider && d.auth_config) elOidcProvider.value = d.auth_config.oidc_provider || 'Keycloak Enterprise';
    if (elIssuerUrl && d.auth_config) elIssuerUrl.value = d.auth_config.issuer_url || 'https://auth.qkd.internal/auth/realms/manufacturing';
    if (elClientId && d.auth_config) elClientId.value = d.auth_config.client_id || 'masar-manufacturing-portal';
    if (elRepoUrl) elRepoUrl.value = d.controlled_doc_repo_url || 'https://docs.qkd.internal/controlled-repo';

    if (elBypassBadge && d.auth_config) {
      if (d.auth_config.dev_bypass_active) {
        elBypassBadge.className = 'p-3 bg-emerald-50 border border-emerald-200 rounded';
        elBypassBadge.innerHTML = `
          <div class="flex items-center space-x-2">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span class="font-bold text-emerald-800">Developer Auth Bypass Active</span>
          </div>
          <p class="text-[11px] text-emerald-700 mt-1">
            Requests authenticated via <code class="font-mono font-bold">X-Bypass-Token</code> header or local dev session.
          </p>
        `;
      } else {
        elBypassBadge.className = 'p-3 bg-gray-50 border border-gray-200 rounded';
        elBypassBadge.innerHTML = `
          <div class="flex items-center space-x-2">
            <span class="w-2.5 h-2.5 rounded-full bg-gray-400"></span>
            <span class="font-bold text-gray-700">Developer Auth Bypass Disabled</span>
          </div>
          <p class="text-[11px] text-gray-500 mt-1">Production OIDC enforcement active.</p>
        `;
      }
    }

    if (elBaselinesList && Array.isArray(d.active_baselines)) {
      elBaselinesList.innerHTML = d.active_baselines.map(bl => `
        <div class="p-3.5 rounded border border-gray-200 bg-gray-50/60 space-y-1.5 hover:bg-slate-50 transition-colors">
          <div class="flex items-center justify-between">
            <span class="font-bold font-mono text-gray-900">${bl.baseline_id}</span>
            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
              CURRENT RELEASE
            </span>
          </div>
          <p class="text-gray-700 font-medium text-[11px]">${bl.name || 'QKD Baseline Release'}</p>
          <div class="text-gray-500 text-[10px] font-mono space-x-2">
            <span>HW: ${bl.hw_revision || 'REV-3.2-A'}</span> • 
            <span>Mech: ${bl.mechanical_revision || 'MECH-ENC-IP67-R2'}</span> • 
            <span>FW: ${bl.fw_version || 'v4.1.0-sec'}</span>
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
    showToast('Failed to load settings: ' + err.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
});
