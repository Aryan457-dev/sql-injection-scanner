const payloads = [
  "' OR '1'='1",
  "' OR 1=1 --",
  "' OR 'a'='a",
  "\" OR \"1\"=\"1",
  "' OR ''='",
  "' OR 1=1#"
];

let scanResults = [];
let isScanning = false;

// Clock
function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  document.getElementById('clock').textContent = `${h}:${m}:${s}`;
}
setInterval(updateClock, 1000);
updateClock();

function log(msg, type = '') {
  const terminal = document.getElementById('terminal');
  const cursor = document.getElementById('cursor');
  const line = document.createElement('div');
  line.className = `term-line ${type}`;
  line.textContent = msg;
  terminal.insertBefore(line, cursor);
  terminal.scrollTop = terminal.scrollHeight;
}

function clearLog() {
  const terminal = document.getElementById('terminal');
  const cursor = document.getElementById('cursor');
  terminal.innerHTML = '';
  terminal.appendChild(cursor);
}

function setProgress(pct, phase, count) {
  document.getElementById('progressFill').style.width = pct + '%';
  document.getElementById('progressPct').textContent = Math.round(pct) + '%';
  document.getElementById('progressPhase').textContent = phase;
  document.getElementById('progressCount').textContent = count;
}

function setPayloadStatus(idx, status) {
  const row = document.querySelector(`.payload-row[data-idx="${idx}"]`);
  const ps = document.getElementById(`ps-${idx}`);
  row.classList.remove('firing', 'vuln', 'safe');
  ps.classList.remove('vuln-s', 'safe-s', 'fire-s');

  if (status === 'firing') {
    row.classList.add('firing');
    ps.textContent = 'TESTING...';
    ps.classList.add('fire-s');
  } else if (status === 'vuln') {
    row.classList.add('vuln');
    ps.textContent = '⚠ VULN';
    ps.classList.add('vuln-s');
  } else if (status === 'safe') {
    row.classList.add('safe');
    ps.textContent = '✓ CLEAN';
    ps.classList.add('safe-s');
  } else {
    ps.textContent = '—';
  }
}

function resetPayloads() {
  for (let i = 0; i < 6; i++) setPayloadStatus(i, 'idle');
}

async function startScan() {
  if (isScanning) return;
  const url = document.getElementById('urlInput').value.trim();
  if (!url) {
    log('[!] Error: Enter a valid target URL', 'warn');
    return;
  }

  isScanning = true;
  scanResults = [];
  resetPayloads();

  const btn = document.getElementById('scanBtn');
  btn.classList.add('running');
  btn.querySelector('.scan-btn-inner').innerHTML = `
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="3" y="3" width="3" height="8" fill="currentColor"/><rect x="8" y="3" width="3" height="8" fill="currentColor"/></svg>
    SCANNING...`;

  document.getElementById('statusDot').className = 'status-dot scanning';
  document.getElementById('statusLabel').textContent = 'SCANNING';
  document.getElementById('progressPulse').classList.add('active');
  document.getElementById('resultsSection').style.display = 'none';
  document.getElementById('resultsBody').innerHTML = '';
  document.getElementById('statVulns').textContent = '0';
  document.getElementById('statClean').textContent = '0';

  clearLog();
  log(`┌─ Scan initiated: ${new Date().toLocaleTimeString()}`, 'head');
  log(`├─ Target: ${url}`, 'info');
  log(`├─ Method: ${document.getElementById('methodSelect').value}`, 'info');
  log(`└─ Payloads: ${payloads.length} queued`, 'info');
  log('', '');

  setProgress(5, 'Establishing baseline...', '0 / 6');

  // Try real backend first, fallback to simulation
  let useSimulation = false;
  let baselineLen = 0;

  try {
    const testRes = await fetch('/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, method: document.getElementById('methodSelect').value }),
      signal: AbortSignal.timeout(3000)
    });
    if (!testRes.ok) throw new Error('Backend error');
    const data = await testRes.json();
    if (data.error) throw new Error(data.error);

    // Real backend responded
    baselineLen = data.baseline;
    log(`[+] Baseline response: ${baselineLen} bytes`, 'ok');
    log('', '');

    let vulns = 0, clean = 0;
    for (let i = 0; i < data.results.length; i++) {
      const r = data.results[i];
      setPayloadStatus(i, 'firing');
      setProgress(10 + ((i + 1) / payloads.length) * 85, `Testing payload ${i + 1}...`, `${i + 1} / 6`);
      await delay(300);

      const isVuln = r.vulnerable;
      setPayloadStatus(i, isVuln ? 'vuln' : 'safe');
      if (isVuln) {
        vulns++;
        log(`[!!!] VULNERABLE  →  ${r.payload}  (Δ${r.diff} bytes)`, 'vuln');
      } else {
        clean++;
        log(`[ ✓ ] Clean       →  ${r.payload}  (Δ${r.diff} bytes)`, 'ok');
      }

      document.getElementById('statVulns').textContent = vulns;
      document.getElementById('statClean').textContent = clean;
      scanResults.push({ idx: i + 1, payload: r.payload, diff: r.diff, vuln: isVuln });
    }

  } catch (e) {
    // Simulation mode — demo without backend
    useSimulation = true;
    log('[~] Running in DEMO mode (Flask backend not detected)', 'warn');
    log('[~] Simulating scan responses...', 'warn');
    log('', '');

    baselineLen = Math.floor(Math.random() * 800) + 1200;
    log(`[+] Baseline response: ${baselineLen} bytes`, 'ok');
    log('', '');

    const demoVulns = [1, 3]; // payload indices that are "vulnerable" in demo
    let vulns = 0, clean = 0;

    for (let i = 0; i < payloads.length; i++) {
      setPayloadStatus(i, 'firing');
      setProgress(10 + ((i + 1) / payloads.length) * 85, `Testing payload ${i + 1}...`, `${i + 1} / 6`);
      await delay(600 + Math.random() * 400);

      const isVuln = demoVulns.includes(i);
      const diff = isVuln ? Math.floor(Math.random() * 900) + 200 : Math.floor(Math.random() * 40) + 2;
      setPayloadStatus(i, isVuln ? 'vuln' : 'safe');

      if (isVuln) {
        vulns++;
        log(`[!!!] VULNERABLE  →  ${payloads[i]}  (Δ${diff} bytes)`, 'vuln');
      } else {
        clean++;
        log(`[ ✓ ] Clean       →  ${payloads[i]}  (Δ${diff} bytes)`, 'ok');
      }

      document.getElementById('statVulns').textContent = vulns;
      document.getElementById('statClean').textContent = clean;
      scanResults.push({ idx: i + 1, payload: payloads[i], diff, vuln: isVuln });
    }
  }

  // Done
  setProgress(100, 'Scan complete', '6 / 6');
  document.getElementById('progressPulse').classList.remove('active');

  const totalVulns = scanResults.filter(r => r.vuln).length;
  log('', '');
  log('─'.repeat(50), 'muted');
  if (totalVulns > 0) {
    log(`[!!!] SCAN COMPLETE — ${totalVulns} VULNERABILITIES DETECTED`, 'vuln');
  } else {
    log('[+] SCAN COMPLETE — No SQL injection detected', 'ok');
  }
  log(`[+] Report ready — ${scanResults.length} payloads tested`, 'info');
  if (useSimulation) log('[~] Connect Flask backend for real scan results', 'warn');

  // Fill results table
  const tbody = document.getElementById('resultsBody');
  for (const r of scanResults) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${String(r.idx).padStart(2, '0')}</td>
      <td style="color: var(--cyan); max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escHtml(r.payload)}</td>
      <td style="color: ${r.diff > 50 ? 'var(--red)' : 'var(--text-dim)'};">Δ${r.diff}</td>
      <td><span class="badge ${r.vuln ? 'vuln' : 'safe'}">${r.vuln ? 'VULNERABLE' : 'CLEAN'}</span></td>
    `;
    tbody.appendChild(tr);
  }
  document.getElementById('resultsSection').style.display = 'block';

  // Reset button
  isScanning = false;
  btn.classList.remove('running');
  btn.querySelector('.scan-btn-inner').innerHTML = `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><polygon points="4,2 14,8 4,14" fill="currentColor"/></svg>
    EXECUTE SCAN`;
  document.getElementById('statusDot').className = 'status-dot done';
  document.getElementById('statusLabel').textContent = totalVulns > 0 ? 'VULN FOUND' : 'COMPLETE';
}

function downloadReport() {
  const url = document.getElementById('urlInput').value.trim();
  let txt = `VULNSCAN PRO — SQL INJECTION REPORT\n`;
  txt += `Generated: ${new Date().toLocaleString()}\n`;
  txt += `Target: ${url}\n\n`;
  txt += `${'─'.repeat(60)}\n\n`;
  for (const r of scanResults) {
    txt += `[${r.idx.toString().padStart(2,'0')}] ${r.vuln ? '⚠ VULNERABLE' : '✓ CLEAN'}  Δ${r.diff} bytes\n`;
    txt += `     Payload: ${r.payload}\n\n`;
  }
  const total = scanResults.filter(r => r.vuln).length;
  txt += `\nSUMMARY: ${total} vulnerabilities found in ${scanResults.length} tests.\n`;
  const blob = new Blob([txt], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `vulnscan_report_${Date.now()}.txt`;
  a.click();
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}