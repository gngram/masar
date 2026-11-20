/**
 * Masar Production Status Controller
 * Manages the Digital Traceability Register for QKD Sender (Alice) and Receiver (Bob) units
 */

let currentUnits = [];

async function loadProduction() {
  try {
    const res = await ProductionAPI.getStatus();
    if (!res.success) return;
    const d = res.data;
    currentUnits = d.units || [];

    const elSenders = document.getElementById('prod-senders');
    const elReceivers = document.getElementById('prod-receivers');
    const elPairs = document.getElementById('prod-pairs');
    const elRework = document.getElementById('prod-rework');
    const elDeviations = document.getElementById('prod-deviations');
    const elReleased = document.getElementById('prod-released');
    const elUnitCount = document.getElementById('prod-unit-count');

    if (elSenders) elSenders.innerText = d.total_senders;
    if (elReceivers) elReceivers.innerText = d.total_receivers;
    if (elPairs) elPairs.innerText = d.total_paired_sets;
    if (elRework) elRework.innerText = d.units_under_rework;
    if (elDeviations) elDeviations.innerText = d.active_deviations;
    if (elReleased) elReleased.innerText = d.units_released;
    if (elUnitCount) elUnitCount.innerText = `${currentUnits.length} total units`;

    renderProductionTable(currentUnits);
  } catch (err) {
    console.error('Failed to load production status:', err);
    showToast('Failed to load production register: ' + err.message, 'error');
  }
}

function renderProductionTable(units) {
  const tbody = document.getElementById('prod-table-body');
  if (!tbody) return;

  if (!units || units.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" class="py-6 text-center text-gray-400">No units found in register.</td></tr>`;
    return;
  }

  tbody.innerHTML = units.map(u => {
    const latestTest = u.test_executions && u.test_executions.length > 0
      ? u.test_executions[u.test_executions.length - 1]
      : null;

    const isAlice = u.unit_type === 'SENDER_ALICE';
    const typeBadge = isAlice
      ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">SENDER (ALICE)</span>'
      : '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">RECEIVER (BOB)</span>';

    const setBadge = u.system_set_id
      ? `<span class="bg-indigo-50 px-2 py-0.5 rounded text-indigo-700 font-bold border border-indigo-200 font-mono">${u.system_set_id}</span>`
      : '<span class="text-gray-400 italic font-mono text-[11px]">Unpaired</span>';

    const reworkBadge = u.rework_history && u.rework_history.length > 0
      ? `<span class="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 font-bold border border-amber-200">${u.rework_history.length} Event(s)</span>`
      : '<span class="text-gray-400">0</span>';

    const devBadge = u.deviations && u.deviations.length > 0
      ? `<span class="px-1.5 py-0.5 rounded text-[10px] bg-rose-100 text-rose-800 font-bold border border-rose-200">${u.deviations.length} Active</span>`
      : '<span class="text-gray-400">0</span>';

    const testLink = latestTest && latestTest.report_url
      ? `<a href="${latestTest.report_url}" target="_blank" class="inline-flex items-center space-x-1 text-indigo-600 hover:text-indigo-800 font-medium underline font-mono text-[11px]"><span>📄</span><span>${latestTest.test_report_id || 'FAT-Report'}</span></a>`
      : '<span class="text-gray-400">Pending</span>';

    const isPassed = ['RELEASED', 'ACCEPTED', 'TEST_PASSED'].includes(u.release_status);
    const releaseBadge = isPassed
      ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">${u.release_status}</span>`
      : `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">${u.release_status}</span>`;

    return `
      <tr class="hover:bg-indigo-50/40 transition-colors">
        <td class="py-2.5 px-3 font-mono font-bold text-gray-900">${u.serial_number}</td>
        <td class="py-2.5 px-3">${typeBadge}</td>
        <td class="py-2.5 px-3">${setBadge}</td>
        <td class="py-2.5 px-3 font-mono text-gray-700">${u.paired_peer_serial || '—'}</td>
        <td class="py-2.5 px-3 font-mono text-gray-700 font-medium">${u.product_baseline?.baseline_id || 'BL-DEF'}</td>
        <td class="py-2.5 px-3 text-gray-600 font-mono text-[11px]">${u.hw_revision || '—'} / ${u.mechanical_revision || '—'}</td>
        <td class="py-2.5 px-3 text-gray-600 font-mono text-[11px]">${u.sw_version || '—'} / ${u.fw_version || '—'}</td>
        <td class="py-2.5 px-3">${reworkBadge}</td>
        <td class="py-2.5 px-3">${devBadge}</td>
        <td class="py-2.5 px-3">${testLink}</td>
        <td class="py-2.5 px-3">${releaseBadge}</td>
      </tr>
    `;
  }).join('');
}

function openPairModal() {
  const senderSelect = document.getElementById('pair-sender-select');
  const receiverSelect = document.getElementById('pair-receiver-select');
  if (!senderSelect || !receiverSelect) return;

  senderSelect.innerHTML = '<option value="">-- Choose Sender (Alice) --</option>' +
    currentUnits.filter(u => u.unit_type === 'SENDER_ALICE').map(s => `
      <option value="${s.id}">${s.serial_number} ${s.system_set_id ? `(Current Set: ${s.system_set_id})` : '(Available)'}</option>
    `).join('');

  receiverSelect.innerHTML = '<option value="">-- Choose Receiver (Bob) --</option>' +
    currentUnits.filter(u => u.unit_type === 'RECEIVER_BOB').map(b => `
      <option value="${b.id}">${b.serial_number} ${b.system_set_id ? `(Current Set: ${b.system_set_id})` : '(Available)'}</option>
    `).join('');

  const modal = document.getElementById('pair-modal');
  if (modal) modal.classList.remove('hidden');
}

function closePairModal() {
  const modal = document.getElementById('pair-modal');
  if (modal) modal.classList.add('hidden');
}

async function submitPairing(e) {
  if (e) e.preventDefault();
  const sId = document.getElementById('pair-sender-select').value;
  const rId = document.getElementById('pair-receiver-select').value;
  const setId = document.getElementById('pair-set-id').value;

  if (!sId || !rId || !setId) {
    showToast('Please select both Alice, Bob, and provide a Set ID', 'warning');
    return;
  }

  try {
    const res = await ProductionAPI.pairUnits(sId, rId, setId);
    if (!res.success) throw new Error(res.error || 'Pairing failed');
    closePairModal();
    showToast(`Successfully paired into Set ${setId}!`, 'success');
    await loadProduction();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadProduction();
});
