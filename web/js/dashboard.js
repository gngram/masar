/**
 * Masar Dashboard Controller
 * Renders high-level manufacturing metrics and activity audit feed
 */

async function loadDashboard() {
  try {
    const res = await CardAPI.getDashboard();
    if (!res.success) return;
    const d = res.data;

    const elYield = document.getElementById('dash-yield');
    const elPairs = document.getElementById('dash-pairs');
    const elAudits = document.getElementById('dash-audits');
    const elAlerts = document.getElementById('dash-alerts');

    if (elYield) elYield.innerText = `${d.first_pass_yield_pct.toFixed(1)}%`;
    if (elPairs) elPairs.innerText = d.active_paired_sets;
    if (elAudits) elAudits.innerText = d.pending_inspections;
    if (elAlerts) elAlerts.innerText = d.critical_stock_alerts;

    const actContainer = document.getElementById('dash-activity-list');
    if (actContainer && Array.isArray(d.recent_activity)) {
      if (d.recent_activity.length === 0) {
        actContainer.innerHTML = '<div class="py-4 text-center text-gray-400">No recent activity recorded.</div>';
      } else {
        actContainer.innerHTML = d.recent_activity.map(a => `
          <div class="py-3 flex items-start justify-between border-b border-gray-100 last:border-b-0 hover:bg-slate-50 px-2 rounded transition-colors">
            <div>
              <div class="flex items-center space-x-2">
                <span class="font-semibold text-gray-900">${a.action}</span>
                <span class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-gray-100 text-gray-600 border border-gray-200">${a.category}</span>
              </div>
              <p class="text-gray-500 text-[11px] mt-0.5">${a.details}</p>
            </div>
            <div class="text-right text-gray-400 text-[11px] whitespace-nowrap pl-4 font-mono">
              <div class="text-gray-700 font-sans font-medium">${a.user}</div>
              <div>${new Date(a.timestamp).toLocaleTimeString()}</div>
            </div>
          </div>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Failed to load dashboard:', err);
    showToast('Failed to load dashboard data: ' + err.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadDashboard();
});
