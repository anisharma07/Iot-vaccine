/* ═══════════════════════════════════════════════════════════
   🚑 Smart Vaccine Delivery System — Dashboard Logic
   Real-time gauges, charts, alerts, event simulation
   ═══════════════════════════════════════════════════════════ */

// ═══════════════════ CONFIGURATION ═══════════════════
const CONFIG = {
  TEMP_MIN: 2,
  TEMP_MAX: 8,
  ACCEL_SHOCK: 20000,
  ACCEL_SPEED: 30000,
  GAS_THRESHOLD: 400,
  HUM_THRESHOLD: 80,
  DAMAGE_CRITICAL: 5,
  UPDATE_INTERVAL: 2000,   // ms between data updates
  MAX_HISTORY: 60,         // chart data points
};

// ═══════════════════ STATE ═══════════════════
let state = {
  temp: 5.0,
  hum: 45.0,
  gas: 80,
  accel: 16384,
  gyro: 1000,
  tamper: 0,
  status: 1,
  damage: 0,
};

let targetState = { ...state };
let alerts = [];
let chartData = {
  labels: [],
  temp: [],
  hum: [],
  gas: [],
  accel: [],
};

let gauges = {};
let timeChart = null;
let updateTimer = null;

// ═══════════════════ INITIALIZATION ═══════════════════
document.addEventListener('DOMContentLoaded', () => {
  initGauges();
  initTimeChart();
  initEventSimulator();
  initClockAndMisc();
  startSimulation();
});

// ═══════════════════ GAUGE RENDERING ═══════════════════
function initGauges() {
  gauges.temp  = createGauge('gaugeTemp',  { min: -10, max: 50, color: '#22d3ee', warnLow: 2, warnHigh: 8 });
  gauges.hum   = createGauge('gaugeHum',   { min: 0,   max: 100, color: '#6366f1', warnHigh: 80 });
  gauges.accel = createGauge('gaugeAccel', { min: 0,   max: 40000, color: '#f97316', warnHigh: 20000 });
  gauges.gas   = createGauge('gaugeGas',   { min: 0,   max: 1000, color: '#a855f7', warnHigh: 400 });
}

function createGauge(canvasId, opts) {
  const canvas = document.getElementById(canvasId);
  const ctx = canvas.getContext('2d');

  // High DPI
  const dpr = window.devicePixelRatio || 1;
  canvas.width = 150 * dpr;
  canvas.height = 100 * dpr;
  ctx.scale(dpr, dpr);

  return { canvas, ctx, opts, value: opts.min };
}

function drawGauge(gauge, value) {
  const { ctx, opts } = gauge;
  const w = 150, h = 100;
  const cx = w / 2, cy = h - 5;
  const r = 60;
  gauge.value = value;

  ctx.clearRect(0, 0, w, h);

  // Normalize value
  const pct = Math.max(0, Math.min(1, (value - opts.min) / (opts.max - opts.min)));

  // Draw background arc
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, 0, false);
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineCap = 'round';
  ctx.stroke();

  // Determine color
  let color = opts.color;
  let inDanger = false;
  if (opts.warnHigh !== undefined && value > opts.warnHigh) { color = '#ef4444'; inDanger = true; }
  if (opts.warnLow  !== undefined && value < opts.warnLow)  { color = '#ef4444'; inDanger = true; }

  // Draw value arc
  const endAngle = Math.PI + (pct * Math.PI);
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, endAngle, false);
  ctx.lineWidth = 10;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = inDanger ? 18 : 10;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Draw tick marks
  for (let i = 0; i <= 10; i++) {
    const angle = Math.PI + (i / 10) * Math.PI;
    const x1 = cx + Math.cos(angle) * (r + 8);
    const y1 = cy + Math.sin(angle) * (r + 8);
    const x2 = cx + Math.cos(angle) * (r + 14);
    const y2 = cy + Math.sin(angle) * (r + 14);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = i % 5 === 0 ? 2 : 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.stroke();
  }
}

// ═══════════════════ TIME CHART ═══════════════════
function initTimeChart() {
  const ctx = document.getElementById('timeChart').getContext('2d');

  // Chart.js dark theme defaults
  Chart.defaults.color = '#94a3b8';
  Chart.defaults.borderColor = 'rgba(255,255,255,0.06)';

  timeChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Temperature (°C)',
          data: [],
          borderColor: '#22d3ee',
          backgroundColor: 'rgba(34,211,238,0.08)',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.35,
          fill: true,
          hidden: false,
        },
        {
          label: 'Humidity (%)',
          data: [],
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99,102,241,0.08)',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.35,
          fill: true,
          hidden: false,
        },
        {
          label: 'Gas (ppm)',
          data: [],
          borderColor: '#a855f7',
          backgroundColor: 'rgba(168,85,247,0.08)',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.35,
          fill: true,
          hidden: true,
        },
        {
          label: 'Accel (raw)',
          data: [],
          borderColor: '#f97316',
          backgroundColor: 'rgba(249,115,22,0.08)',
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          tension: 0.35,
          fill: true,
          hidden: true,
          yAxisID: 'y1',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        intersect: false,
        mode: 'index',
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: 'rgba(17,24,39,0.95)',
          borderColor: 'rgba(99,102,241,0.3)',
          borderWidth: 1,
          titleFont: { family: "'Inter', sans-serif", size: 12 },
          bodyFont: { family: "'JetBrains Mono', monospace", size: 11 },
          padding: 10,
          cornerRadius: 8,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxTicksLimit: 8, font: { size: 10 } },
        },
        y: {
          position: 'left',
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { font: { size: 10 } },
        },
        y1: {
          position: 'right',
          grid: { display: false },
          ticks: { font: { size: 10 } },
          display: false,
        },
      },
      animation: {
        duration: 600,
        easing: 'easeOutQuart',
      },
    },
  });

  // Toggle buttons
  document.querySelectorAll('.toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('active');
      const ds = btn.dataset.ds;
      const dsIndex = { temp: 0, hum: 1, gas: 2, accel: 3 }[ds];
      timeChart.data.datasets[dsIndex].hidden = !btn.classList.contains('active');

      // Show y1 axis if accel visible
      timeChart.options.scales.y1.display = !timeChart.data.datasets[3].hidden;
      timeChart.update();
    });
  });
}

function updateChart() {
  const now = new Date();
  const label = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  timeChart.data.labels.push(label);
  timeChart.data.datasets[0].data.push(state.temp);
  timeChart.data.datasets[1].data.push(state.hum);
  timeChart.data.datasets[2].data.push(state.gas);
  timeChart.data.datasets[3].data.push(state.accel);

  // Trim to max
  if (timeChart.data.labels.length > CONFIG.MAX_HISTORY) {
    timeChart.data.labels.shift();
    timeChart.data.datasets.forEach(ds => ds.data.shift());
  }

  timeChart.update('none'); // no animation for smooth updates
}

// ═══════════════════ STATUS EVALUATION ═══════════════════
function evaluateStatus() {
  let damage = 0;
  let statusCode = 1;

  if (state.temp > CONFIG.TEMP_MAX || state.temp < CONFIG.TEMP_MIN) {
    statusCode = 0;
    damage += 3;
  }
  if (state.tamper) {
    statusCode = 2;
    damage += 2;
  }
  if (state.accel > CONFIG.ACCEL_SHOCK) {
    statusCode = 3;
    damage += 2;
  }
  if (state.gyro > CONFIG.ACCEL_SPEED) {
    statusCode = 4;
    damage += 1;
  }
  if (state.gas > CONFIG.GAS_THRESHOLD) {
    statusCode = 5;
    damage += 3;
  }
  if (state.hum > CONFIG.HUM_THRESHOLD) {
    statusCode = 6;
    damage += 1;
  }
  if (damage >= CONFIG.DAMAGE_CRITICAL) {
    statusCode = 9;
  }

  state.status = statusCode;
  state.damage = damage;
}

// ═══════════════════ UI UPDATES ═══════════════════
function updateUI() {
  // Gauges
  drawGauge(gauges.temp,  state.temp);
  drawGauge(gauges.hum,   state.hum);
  drawGauge(gauges.accel, state.accel);
  drawGauge(gauges.gas,   state.gas);

  // Values
  document.getElementById('valTemp').textContent  = state.temp.toFixed(1);
  document.getElementById('valHum').textContent   = state.hum.toFixed(1);
  document.getElementById('valAccel').textContent = Math.round(state.accel);
  document.getElementById('valGas').textContent   = Math.round(state.gas);

  // Badges
  updateBadge('tempBadge',  state.temp >= CONFIG.TEMP_MIN && state.temp <= CONFIG.TEMP_MAX);
  updateBadge('humBadge',   state.hum <= CONFIG.HUM_THRESHOLD);
  updateBadge('accelBadge', state.accel <= CONFIG.ACCEL_SHOCK);
  updateBadge('gasBadge',   state.gas <= CONFIG.GAS_THRESHOLD);

  // Status indicators
  updateIndicator('siTempDot',   state.temp >= CONFIG.TEMP_MIN && state.temp <= CONFIG.TEMP_MAX);
  updateIndicator('siHumDot',    state.hum <= CONFIG.HUM_THRESHOLD);
  updateIndicator('siAccelDot',  state.accel <= CONFIG.ACCEL_SHOCK);
  updateIndicator('siSpeedDot',  state.gyro  <= CONFIG.ACCEL_SPEED);
  updateIndicator('siGasDot',    state.gas   <= CONFIG.GAS_THRESHOLD);
  updateIndicator('siTamperDot', !state.tamper);

  // Status banner
  updateStatusBanner();

  // Damage ring
  updateDamageRing();

  // Reference table highlight
  updateRefTable();

  // Chart
  updateChart();
}

function updateBadge(id, isOk) {
  const badge = document.getElementById(id);
  badge.textContent = isOk ? 'OK' : 'ALERT';
  badge.className = 'card-badge' + (isOk ? '' : ' danger');
}

function updateIndicator(id, isOk) {
  const dot = document.getElementById(id);
  dot.className = 'si-indicator ' + (isOk ? 'ok' : 'danger');
}

function updateStatusBanner() {
  const banner = document.getElementById('statusBanner');
  const icon   = document.getElementById('statusIcon');
  const label  = document.getElementById('statusLabel');
  const detail = document.getElementById('statusDetail');

  const statusInfo = {
    0: { icon: '❄️',  label: 'COLD CHAIN FAILURE',   detail: 'Temperature outside safe range (2–8°C)', cls: 'danger' },
    1: { icon: '✅',  label: 'SYSTEM NORMAL',         detail: 'All parameters within safe limits',       cls: 'ok' },
    2: { icon: '🔓',  label: 'TAMPER DETECTED',       detail: 'Vaccine box has been opened',              cls: 'warn' },
    3: { icon: '💥',  label: 'SHOCK / DROP',          detail: 'High acceleration detected — possible impact', cls: 'danger' },
    4: { icon: '🏎️',  label: 'UNSAFE DRIVING',        detail: 'Excessive speed / rash driving detected', cls: 'warn' },
    5: { icon: '🌫️',  label: 'GAS LEAKAGE',           detail: 'Abnormal gas levels — possible spoilage',  cls: 'danger' },
    6: { icon: '💧',  label: 'HIGH HUMIDITY',          detail: 'Condensation / moisture risk detected',    cls: 'warn' },
    9: { icon: '🚨',  label: 'CRITICAL ALERT',        detail: 'Multiple safety violations — immediate action required!', cls: 'danger' },
  };

  const info = statusInfo[state.status] || statusInfo[1];
  icon.textContent  = info.icon;
  label.textContent = info.label;
  detail.textContent = info.detail;
  banner.className = 'status-banner status-' + info.cls;
}

function updateDamageRing() {
  const ringFill    = document.getElementById('ringFill');
  const damageValue = document.getElementById('damageValue');
  const circumference = 2 * Math.PI * 50; // r=50
  const halfCircumference = circumference / 2; // we only use top half

  const pct = Math.min(state.damage / 10, 1);
  const offset = halfCircumference * (1 - pct);

  ringFill.style.strokeDasharray = halfCircumference;
  ringFill.style.strokeDashoffset = offset;

  // Color based on damage
  if (state.damage >= 7) {
    ringFill.style.stroke = '#ef4444';
  } else if (state.damage >= 4) {
    ringFill.style.stroke = '#f59e0b';
  } else {
    ringFill.style.stroke = '#10b981';
  }

  damageValue.textContent = state.damage;
}

function updateRefTable() {
  document.querySelectorAll('.ref-row').forEach(row => row.classList.remove('active-ref'));
  const activeRow = document.getElementById('ref' + state.status);
  if (activeRow) activeRow.classList.add('active-ref');
}

// ═══════════════════ ALERTS ═══════════════════
let lastStatus = 1;

function checkAlerts() {
  if (state.status !== 1 && state.status !== lastStatus) {
    addAlert(state.status);
  }
  lastStatus = state.status;
}

function addAlert(statusCode) {
  const msgs = {
    0: { msg: 'Cold chain failure — temperature out of range',     sev: 'critical' },
    2: { msg: 'Tamper detected — vaccine box opened',               sev: 'warning' },
    3: { msg: 'Shock/drop detected — high acceleration',            sev: 'critical' },
    4: { msg: 'Unsafe driving — excessive speed',                    sev: 'warning' },
    5: { msg: 'Gas leakage detected — possible spoilage',           sev: 'critical' },
    6: { msg: 'High humidity — condensation risk',                   sev: 'warning' },
    9: { msg: '🚨 CRITICAL — multiple safety violations!',          sev: 'critical' },
  };

  const info = msgs[statusCode];
  if (!info) return;

  const now = new Date();
  const time = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  alerts.unshift({ time, msg: info.msg, sev: info.sev });
  if (alerts.length > 50) alerts.pop();

  renderAlerts();
}

function renderAlerts() {
  const list = document.getElementById('alertList');

  if (alerts.length === 0) {
    list.innerHTML = '<div class="alert-empty">No alerts yet — system monitoring active</div>';
    return;
  }

  list.innerHTML = alerts.map(a =>
    `<div class="alert-item ${a.sev}">
      <span class="alert-time">${a.time}</span>
      <span class="alert-msg">${a.msg}</span>
    </div>`
  ).join('');
}

// Clear alerts
document.getElementById('clearAlerts')?.addEventListener('click', () => {
  alerts = [];
  renderAlerts();
});

// ═══════════════════ EVENT SIMULATOR ═══════════════════
function initEventSimulator() {
  const presets = {
    normal:   { temp: 5.0,  hum: 45, gas: 80,  accel: 16384, gyro: 1000,  tamper: 0 },
    heat:     { temp: 15.0, hum: 50, gas: 100, accel: 16384, gyro: 1000,  tamper: 0 },
    cold:     { temp: -2.0, hum: 30, gas: 80,  accel: 16384, gyro: 1000,  tamper: 0 },
    drop:     { temp: 5.5,  hum: 45, gas: 80,  accel: 28000, gyro: 5000,  tamper: 0 },
    speed:    { temp: 5.5,  hum: 45, gas: 80,  accel: 18000, gyro: 35000, tamper: 0 },
    gas:      { temp: 5.5,  hum: 55, gas: 650, accel: 16384, gyro: 1000,  tamper: 0 },
    humid:    { temp: 6.0,  hum: 90, gas: 80,  accel: 16384, gyro: 1000,  tamper: 0 },
    critical: { temp: 12.0, hum: 85, gas: 550, accel: 25000, gyro: 32000, tamper: 1 },
  };

  document.querySelectorAll('.sim-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const event = btn.dataset.event;
      const preset = presets[event];
      if (!preset) return;

      targetState = { ...preset };

      // Visual feedback
      btn.style.transform = 'scale(0.92)';
      setTimeout(() => btn.style.transform = '', 200);

      // Flash connection badge
      const badge = document.getElementById('connectionBadge');
      badge.querySelector('.label').textContent = 'Event: ' + event.toUpperCase();
      setTimeout(() => {
        badge.querySelector('.label').textContent = 'Simulating';
      }, 2000);
    });
  });
}

// ═══════════════════ SMOOTH VALUE TRANSITIONS ═══════════════════
function lerpState() {
  const speed = 0.15; // smoothing factor
  state.temp  += (targetState.temp  - state.temp)  * speed;
  state.hum   += (targetState.hum   - state.hum)   * speed;
  state.gas   += (targetState.gas   - state.gas)    * speed;
  state.accel += (targetState.accel - state.accel)  * speed;
  state.gyro  += (targetState.gyro  - state.gyro)   * speed;
  state.tamper = targetState.tamper;

  // Add realistic noise
  state.temp  += (Math.random() - 0.5) * 0.15;
  state.hum   += (Math.random() - 0.5) * 0.4;
  state.gas   += (Math.random() - 0.5) * 5;
  state.accel += (Math.random() - 0.5) * 300;
}

// ═══════════════════ SIMULATION LOOP ═══════════════════
function startSimulation() {
  updateTimer = setInterval(() => {
    lerpState();
    evaluateStatus();
    checkAlerts();
    updateUI();
  }, CONFIG.UPDATE_INTERVAL);

  // Initial draw
  evaluateStatus();
  updateUI();
}

// ═══════════════════ CLOCK ═══════════════════
function initClockAndMisc() {
  function tickClock() {
    const now = new Date();
    document.getElementById('liveClock').textContent =
      now.toLocaleTimeString('en-US', { hour12: false });
  }
  tickClock();
  setInterval(tickClock, 1000);
}
