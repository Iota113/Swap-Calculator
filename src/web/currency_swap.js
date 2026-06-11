// App State
let curve1MarketQuotes = [];
let curve2MarketQuotes = [];
let basisMarketQuotes = [];
let calculationResults = null;
let currentChartType = 'zero_rate';
let curvesChart = null;
let timelineChart = null;

// DOM Elements
const themeToggleBtn = document.getElementById('theme-toggle');
const tradeDateInput = document.getElementById('trade-date');
const spotFxInput = document.getElementById('spot-fx-rate');
const calculateBtn = document.getElementById('calculate-btn');
const resetCurvesBtn = document.getElementById('reset-curves-btn');
const resultsContainer = document.getElementById('results-container');
const alertContainer = document.getElementById('alert-container');

// Leg 1 Elements
const leg1Currency = document.getElementById('leg1-currency');
const leg1Position = document.getElementById('leg1-position');
const leg1Type = document.getElementById('leg1-type');
const leg1Rate = document.getElementById('leg1-rate');
const leg1RateLabel = document.getElementById('leg1-rate-label');
const leg1Notional = document.getElementById('leg1-notional');
const leg1Frequency = document.getElementById('leg1-frequency');
const leg1Daycount = document.getElementById('leg1-daycount');
const leg1Tenor = document.getElementById('leg1-tenor');

// Leg 2 Elements
const leg2Currency = document.getElementById('leg2-currency');
const leg2Position = document.getElementById('leg2-position');
const leg2Type = document.getElementById('leg2-type');
const leg2Rate = document.getElementById('leg2-rate');
const leg2RateLabel = document.getElementById('leg2-rate-label');
const leg2Notional = document.getElementById('leg2-notional');
const leg2Frequency = document.getElementById('leg2-frequency');
const leg2Daycount = document.getElementById('leg2-daycount');
const leg2Tenor = document.getElementById('leg2-tenor');

// Recalc & Label Elements
const recalcNotionalBtn = document.getElementById('recalc-notional-btn');
const fxPairLabel = document.getElementById('fx-pair-label');
const curve1Name = document.getElementById('curve1-name');
const curve2Name = document.getElementById('curve2-name');
const basisPairName = document.getElementById('basis-pair-name');
const curve1NodesTitle = document.getElementById('curve1-nodes-title');
const curve2NodesTitle = document.getElementById('curve2-nodes-title');
const curve1Dropzone = document.getElementById('curve1-dropzone');
const curve1FileInput = document.getElementById('curve1-file');
const curve1Status = document.getElementById('curve1-status');
const curve2Dropzone = document.getElementById('curve2-dropzone');
const curve2FileInput = document.getElementById('curve2-file');
const curve2Status = document.getElementById('curve2-status');
const basisDropzone = document.getElementById('basis-dropzone');
const basisFileInput = document.getElementById('basis-file');
const basisStatus = document.getElementById('basis-status');

// Output Tables & Toggles
const showZeroRateBtn = document.getElementById('show-zero-rate');
const showDfBtn = document.getElementById('show-df');
const showFxForwardBtn = document.getElementById('show-fx-forward');
const cashflowsTbody = document.getElementById('cashflows-tbody');
const curve1KnotsTbody = document.getElementById('curve1-knots-tbody');
const curve2KnotsTbody = document.getElementById('curve2-knots-tbody');
const basisKnotsTbody = document.getElementById('basis-knots-tbody');
const fxForwardTbody = document.getElementById('fx-forward-tbody');
const exportCashflowsBtn = document.getElementById('export-cashflows');

const showCurve1TableBtn = document.getElementById('show-curve1-table');
const showCurve2TableBtn = document.getElementById('show-curve2-table');
const showBasisTableBtn = document.getElementById('show-basis-table');
const showFxTableBtn = document.getElementById('show-fx-table');
const curve1TableWrapper = document.getElementById('curve1-table-wrapper');
const curve2TableWrapper = document.getElementById('curve2-table-wrapper');
const basisTableWrapper = document.getElementById('basis-table-wrapper');
const fxTableWrapper = document.getElementById('fx-table-wrapper');
const curve1TabLabel = document.getElementById('curve1-tab-label');
const curve2TabLabel = document.getElementById('curve2-tab-label');
const basisTabLabel = document.getElementById('basis-tab-label');

// Initial Setup
document.addEventListener('DOMContentLoaded', () => {
    // Theme sync
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    // Formatting & Sync listeners
    initNotionalFormatting(leg1Notional);
    initNotionalFormatting(leg2Notional);
    initSyncingListeners();
    updateLabelStates();
});

// Comma Formatting Utilities
function formatWithCommas(value) {
    let num = value.replace(/[^0-9.]/g, '');
    if (!num) return '';
    let parts = num.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
}

function stripCommas(value) {
    return parseFloat(value.replace(/,/g, '')) || 0.0;
}

function initNotionalFormatting(input) {
    input.addEventListener('input', (e) => {
        e.target.value = formatWithCommas(e.target.value);
    });
    input.value = formatWithCommas(input.value);
}

// UI Label Syncing
function updateLabelStates() {
    const c1 = leg1Currency.value;
    const c2 = leg2Currency.value;

    // Label pairs
    if (fxPairLabel) fxPairLabel.textContent = `${c1}/${c2}`;
    if (curve1Name) curve1Name.textContent = c1;
    if (curve2Name) curve2Name.textContent = c2;
    if (basisPairName) basisPairName.textContent = `${c2}/${c1}`; // EUR/USD basis (Leg 2/Leg 1)
    if (curve1NodesTitle) curve1NodesTitle.textContent = c1;
    if (curve2NodesTitle) curve2NodesTitle.textContent = c2;

    document.querySelectorAll('.leg1-curr-label').forEach(el => el.textContent = c1);
    document.querySelectorAll('.leg2-curr-label').forEach(el => el.textContent = c2);

    if (curve1TabLabel) curve1TabLabel.textContent = `${c1} Nodes`;
    if (curve2TabLabel) curve2TabLabel.textContent = `${c2} Nodes`;
    if (basisTabLabel) basisTabLabel.textContent = `${c2} Basis Nodes`;

    // Leg 1 type label
    if (leg1Type && leg1RateLabel) {
        if (leg1Type.value === 'fixed') {
            leg1RateLabel.textContent = 'Fixed Rate (%)';
        } else {
            leg1RateLabel.textContent = 'Spread (%)';
        }
    }

    // Leg 2 type label
    if (leg2Type && leg2RateLabel) {
        if (leg2Type.value === 'fixed') {
            leg2RateLabel.textContent = 'Fixed Rate (%)';
        } else {
            leg2RateLabel.textContent = 'Spread (%)';
        }
    }
}

function initSyncingListeners() {
    leg1Currency.addEventListener('change', updateLabelStates);
    leg2Currency.addEventListener('change', updateLabelStates);

    leg1Type.addEventListener('change', updateLabelStates);
    leg2Type.addEventListener('change', updateLabelStates);

    // Leg 1 Position controls Leg 2 Position
    leg1Position.addEventListener('change', (e) => {
        leg2Position.value = e.target.value === 'receiver' ? 'payer' : 'receiver';
    });

    // Leg 1 Tenor controls Leg 2 Tenor
    leg1Tenor.addEventListener('input', (e) => {
        leg2Tenor.value = e.target.value;
    });

    // Recalc Notional Button
    recalcNotionalBtn.addEventListener('click', () => {
        const spotFx = parseFloat(spotFxInput.value) || 1.0;
        const n1 = stripCommas(leg1Notional.value);
        if (n1 > 0 && spotFx > 0) {
            const n2 = n1 / spotFx;
            leg2Notional.value = formatWithCommas(n2.toFixed(2));
            showAlert('Leg 2 notional successfully synced with Leg 1 notional and Spot FX rate.', 'success');
        }
    });
}

// Drag & Drop / File Uploads Curve 1
curve1Dropzone.addEventListener('click', () => curve1FileInput.click());
curve1Dropzone.addEventListener('dragover', (e) => { e.preventDefault(); curve1Dropzone.classList.add('dragover'); });
curve1Dropzone.addEventListener('dragleave', () => curve1Dropzone.classList.remove('dragover'));
curve1Dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    curve1Dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) handleCurveFile(e.dataTransfer.files[0], 1);
});
curve1FileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleCurveFile(e.target.files[0], 1);
});

// Drag & Drop / File Uploads Curve 2
curve2Dropzone.addEventListener('click', () => curve2FileInput.click());
curve2Dropzone.addEventListener('dragover', (e) => { e.preventDefault(); curve2Dropzone.classList.add('dragover'); });
curve2Dropzone.addEventListener('dragleave', () => curve2Dropzone.classList.remove('dragover'));
curve2Dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    curve2Dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) handleCurveFile(e.dataTransfer.files[0], 2);
});
curve2FileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleCurveFile(e.target.files[0], 2);
});

// Drag & Drop / File Uploads Curve Basis
basisDropzone.addEventListener('click', () => basisFileInput.click());
basisDropzone.addEventListener('dragover', (e) => { e.preventDefault(); basisDropzone.classList.add('dragover'); });
basisDropzone.addEventListener('dragleave', () => basisDropzone.classList.remove('dragover'));
basisDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    basisDropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) handleCurveFile(e.dataTransfer.files[0], 3);
});
basisFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleCurveFile(e.target.files[0], 3);
});

function handleCurveFile(file, curveNum) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const parsed = parseCSV(e.target.result);
            if (parsed.length > 0) {
                if (curveNum === 1) {
                    curve1MarketQuotes = parsed;
                    curve1Status.innerHTML = `<span style="color: var(--success); font-weight: 600;"><i class="fa-solid fa-circle-check"></i> Loaded ${parsed.length} quotes from ${file.name}</span>`;
                } else if (curveNum === 2) {
                    curve2MarketQuotes = parsed;
                    curve2Status.innerHTML = `<span style="color: var(--success); font-weight: 600;"><i class="fa-solid fa-circle-check"></i> Loaded ${parsed.length} quotes from ${file.name}</span>`;
                } else {
                    basisMarketQuotes = parsed;
                    basisStatus.innerHTML = `<span style="color: var(--success); font-weight: 600;"><i class="fa-solid fa-circle-check"></i> Loaded ${parsed.length} quotes from ${file.name}</span>`;
                }
                showAlert(`Curve ${curveNum} market data successfully loaded!`, 'success');
            } else {
                showAlert('CSV file was empty or missing required columns.', 'danger');
            }
        } catch (err) {
            showAlert(`CSV parsing error: ${err.message}`, 'danger');
        }
    };
    reader.readAsText(file);
}

function parseCSV(text) {
    const lines = text.split(/\r?\n/);
    if (lines.length === 0) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
    const instIdx = headers.findIndex(h => h.toLowerCase() === 'instrument');
    const tenorIdx = headers.findIndex(h => h.toLowerCase() === 'tenor');
    const typeIdx = headers.findIndex(h => h.toLowerCase() === 'quotetype');
    const quoteIdx = headers.findIndex(h => h.toLowerCase() === 'quote');
    const spreadIdx = headers.findIndex(h => h.toLowerCase() === 'spread');

    if (instIdx === -1 || tenorIdx === -1 || typeIdx === -1 || quoteIdx === -1) {
        throw new Error('CSV headers must include: Instrument, Tenor, QuoteType, Quote');
    }

    const records = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const cols = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
        if (cols.length <= Math.max(instIdx, tenorIdx, typeIdx, quoteIdx)) continue;

        const spreadVal = spreadIdx !== -1 ? cols[spreadIdx] : '';
        const spread = spreadVal !== '' && !isNaN(parseFloat(spreadVal)) ? parseFloat(spreadVal) : null;

        records.push({
            Instrument: cols[instIdx].charAt(0).toUpperCase() + cols[instIdx].slice(1).toLowerCase(),
            Tenor: cols[tenorIdx].toUpperCase(),
            QuoteType: cols[typeIdx].toUpperCase(),
            Quote: parseFloat(cols[quoteIdx]) || 0.0,
            Spread: spread
        });
    }
    return records;
}

resetCurvesBtn.addEventListener('click', () => {
    curve1MarketQuotes = [];
    curve2MarketQuotes = [];
    basisMarketQuotes = [];
    curve1Status.textContent = 'Using default USD OIS curve sample data.';
    curve2Status.textContent = 'Using default EUR curve sample data.';
    basisStatus.textContent = 'Using default EUR/USD market basis curve sample data.';
    curve1FileInput.value = '';
    curve2FileInput.value = '';
    basisFileInput.value = '';
    showAlert('Reset back to default sample curves.', 'info');
    triggerCalculation();
});

// Alert Handler
function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    let iconClass = 'fa-circle-info';
    if (type === 'danger') iconClass = 'fa-circle-xmark';
    if (type === 'success') iconClass = 'fa-circle-check';

    alertDiv.innerHTML = `
        <i class="fa-solid ${iconClass}"></i>
        <span>${message}</span>
    `;
    alertContainer.innerHTML = '';
    alertContainer.appendChild(alertDiv);

    if (type !== 'danger') {
        setTimeout(() => {
            alertDiv.style.opacity = '0';
            alertDiv.style.transform = 'translateY(-10px)';
            alertDiv.style.transition = 'all 0.5s ease';
            setTimeout(() => alertDiv.remove(), 500);
        }, 5000);
    }
}

// Theme Toggle
themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);

    if (calculationResults) {
        renderCurvesChart();
        renderTimelineChart();
    }
});

function updateThemeIcon(theme) {
    const icon = themeToggleBtn.querySelector('i');
    icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}

// Calculate Action
calculateBtn.addEventListener('click', triggerCalculation);

async function triggerCalculation() {
    calculateBtn.disabled = true;
    calculateBtn.innerHTML = `<span class="spinner"></span> Pricing Swap...`;

    const tradeDate = tradeDateInput.value.trim();
    const spotFx = parseFloat(spotFxInput.value) || 1.0;

    const leg1 = {
        currency: leg1Currency.value,
        notional: stripCommas(leg1Notional.value),
        rate_type: leg1Type.value,
        rate_or_spread: parseFloat(leg1Rate.value) || 0.0,
        frequency: parseInt(leg1Frequency.value),
        day_count: leg1Daycount.value,
        tenor_years: parseInt(leg1Tenor.value),
        is_payer: leg1Position.value === 'payer'
    };

    const leg2 = {
        currency: leg2Currency.value,
        notional: stripCommas(leg2Notional.value),
        rate_type: leg2Type.value,
        rate_or_spread: parseFloat(leg2Rate.value) || 0.0,
        frequency: parseInt(leg2Frequency.value),
        day_count: leg2Daycount.value,
        tenor_years: parseInt(leg1Tenor.value), // Matched
        is_payer: leg2Position.value === 'payer'
    };

    const curve_config1 = {
        day_count_convention: leg1Daycount.value,
        payment_frequency: parseInt(leg1Frequency.value),
        interpolation_method: document.getElementById('curve1-interpolation').value,
        futures_cutoff_years: parseFloat(document.getElementById('curve1-cutoff').value) || 2.0
    };

    const curve_config2 = {
        day_count_convention: leg2Daycount.value,
        payment_frequency: parseInt(leg2Frequency.value),
        interpolation_method: document.getElementById('curve2-interpolation').value,
        futures_cutoff_years: parseFloat(document.getElementById('curve2-cutoff').value) || 2.0
    };

    try {
        const response = await fetch('/api/calculate_currency_swap', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                trade_date: tradeDate,
                spot_fx_rate: spotFx,
                leg1: leg1,
                leg2: leg2,
                curve_config1: curve_config1,
                curve_config2: curve_config2,
                leg1_market_data: curve1MarketQuotes,
                leg2_market_data: curve2MarketQuotes,
                basis_market_data: basisMarketQuotes
            })
        });

        const data = await response.json();

        if (!data.success) {
            showAlert(data.error || 'Pricing calculation failed.', 'danger');
            resultsContainer.style.display = 'none';
        } else {
            calculationResults = data;
            resultsContainer.style.display = 'grid';
            showAlert('Cross-currency swap valued successfully!', 'success');

            updateNPVDisplays(data.npv_results);
            renderRiskResults(data.risk_results);
            renderCashflowTable(data.cashflows);
            renderKnotTables(data.leg1_knots, data.leg2_knots, data.basis_knots);
            renderFXForwardTable(data.fx_forward_curve);

            renderCurvesChart();
            renderTimelineChart();

            resultsContainer.scrollIntoView({ behavior: 'smooth' });
        }
    } catch (err) {
        showAlert(`Server connection error: ${err.message}`, 'danger');
    } finally {
        calculateBtn.disabled = false;
        calculateBtn.innerHTML = `<i class="fa-solid fa-bolt"></i> Calculate Swap Price & NPV`;
    }
}

function formatRiskAmount(value, currency) {
    if (value === null || value === undefined) return '—';
    const prefix = value >= 0 ? '+' : '';
    return `${prefix}${currency} ${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function renderRiskResults(risk) {
    if (!risk || !risk.parallel) return;

    const c1 = leg1Currency.value;
    const p = risk.parallel;

    document.getElementById('risk-leg1-dv01').textContent = formatRiskAmount(p.leg1_dv01, c1);
    document.getElementById('risk-leg2-dv01').textContent = formatRiskAmount(p.leg2_dv01, c1);
    
    if (document.getElementById('risk-basis-dv01')) {
        document.getElementById('risk-basis-dv01').textContent = formatRiskAmount(p.basis_dv01, c1);
    }

    const fxEl = document.getElementById('risk-fx-delta');
    const fxDelta = p.fx_delta_1pct;
    fxEl.textContent = `${fxDelta >= 0 ? '+' : '-'}${c1} ${Math.abs(fxDelta).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    fxEl.style.color = fxDelta >= 0 ? 'var(--success)' : 'var(--danger)';

    const leg1SpreadWrap = document.getElementById('risk-leg1-spread-wrap');
    const leg2SpreadWrap = document.getElementById('risk-leg2-spread-wrap');
    if (p.leg1_spread_pvbp != null) {
        leg1SpreadWrap.style.display = 'block';
        document.getElementById('risk-leg1-spread').textContent = formatRiskAmount(p.leg1_spread_pvbp, c1);
    } else {
        leg1SpreadWrap.style.display = 'none';
    }
    if (p.leg2_spread_pvbp != null) {
        leg2SpreadWrap.style.display = 'block';
        document.getElementById('risk-leg2-spread').textContent = formatRiskAmount(p.leg2_spread_pvbp, c1);
    } else {
        leg2SpreadWrap.style.display = 'none';
    }

    const methodNote = document.getElementById('risk-method-note');
    if (risk.method) {
        methodNote.textContent = `Rate bumps: ${risk.method.rate_bump}. FX: ${risk.method.fx_bump}. Spread: ${risk.method.spread_bump}. All ΔNPV in ${c1}.`;
    }

    renderDeltaVectorTable('leg1-delta-tbody', risk.leg1_delta_vector || [], c1);
    renderDeltaVectorTable('leg2-delta-tbody', risk.leg2_delta_vector || [], c1);
    renderDeltaVectorTable('basis-delta-tbody', risk.basis_delta_vector || [], c1);
    
    // Reset inputs on new pricing calculation runs
    document.querySelectorAll('.pnl-move-input').forEach(input => input.value = "0.0");
    const fxInput = document.getElementById('pnl-fx-bump');
    if (fxInput) fxInput.value = "0.0";
    
    updatePnlAttribution();
}

function renderDeltaVectorTable(tbodyId, rows, currency) {
    const tbody = document.getElementById(tbodyId);
    tbody.innerHTML = '';
    if (!rows.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">No pillars</td></tr>';
        return;
    }
    rows.forEach(row => {
        const tr = document.createElement('tr');
        const deltaColor = row.delta >= 0 ? 'color: var(--success);' : 'color: var(--danger);';
        const quoteLabel = row.quote_type === 'PRICE' ? row.quote.toFixed(4) : `${row.quote.toFixed(4)}%`;
        tr.innerHTML = `
            <td>${row.instrument}</td>
            <td>${row.tenor}</td>
            <td style="font-family: monospace;">${quoteLabel}</td>
            <td style="${deltaColor} font-family: monospace; font-weight: 600;">${row.delta >= 0 ? '+' : ''}${currency} ${row.delta.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td style="width: 80px; padding: 4px 6px;">
                <input type="number" class="pnl-move-input" data-delta="${row.delta}" value="0.0" step="0.1" 
                    style="width: 60px; padding: 4px 6px; font-size: 11px; text-align: center; background: rgba(255, 255, 255, 0.05); border: 1px solid var(--border-color); border-radius: 4px; color: var(--text-primary);">
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function updateNPVDisplays(results) {
    const c1 = leg1Currency.value;

    document.getElementById('leg1-interest-pv-display').textContent = `Interest PV: ${c1} ${results.leg1_interest_pv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('leg1-notional-pv-display').textContent = `Notional PV: ${c1} ${results.leg1_notional_pv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('leg1-total-pv-display').textContent = `${c1} ${results.leg1_total_pv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    document.getElementById('leg2-interest-pv-display').textContent = `Interest PV: ${c1} ${results.leg2_interest_pv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('leg2-notional-pv-display').textContent = `Notional PV: ${c1} ${results.leg2_notional_pv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    document.getElementById('leg2-total-pv-display').textContent = `${c1} ${results.leg2_total_pv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const netNPV = document.getElementById('net-npv-display');
    netNPV.textContent = `${c1} ${results.total_net_npv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Style Net NPV based on sign
    if (results.total_net_npv >= 0.0) {
        netNPV.style.color = 'var(--success)';
        netNPV.style.textShadow = '0 0 10px rgba(16,185,129,0.25)';
    } else {
        netNPV.style.color = 'var(--danger)';
        netNPV.style.textShadow = '0 0 10px rgba(239,68,68,0.25)';
    }
}

function renderCashflowTable(cashflows) {
    cashflowsTbody.innerHTML = '';
    cashflows.forEach(cf => {
        const tr = document.createElement('tr');

        // Highlight maturity principal exchange row
        if (cf.type === 'principal') {
            tr.style.background = 'rgba(255, 255, 255, 0.04)';
            tr.style.fontWeight = 'bold';
        }

        // Colors for positive/negative cashflows
        const l1Color = cf.leg1_amount >= 0 ? 'color: var(--success);' : 'color: var(--danger);';
        const l2Color = cf.leg2_amount >= 0 ? 'color: var(--success);' : 'color: var(--danger);';
        const netColor = cf.net_cashflow >= 0 ? 'color: var(--success);' : 'color: var(--danger);';

        tr.innerHTML = `
            <td>${cf.date}</td>
            <td><span class="status-badge ${cf.type === 'principal' ? 'active' : 'skipped'}">${cf.type.toUpperCase()}</span></td>
            <td style="${l1Color}">${cf.leg1_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td style="${l2Color}">${cf.leg2_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td>${cf.fx_forward.toFixed(6)}</td>
            <td style="${l2Color}">${cf.leg2_converted.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td style="${netColor}">${cf.net_cashflow.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td>${cf.df.toFixed(6)}</td>
            <td style="${netColor} font-weight: bold;">${cf.pv.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
        `;
        cashflowsTbody.appendChild(tr);
    });
}

function renderKnotTables(knots1, knots2, knotsBasis) {
    curve1KnotsTbody.innerHTML = '';
    knots1.forEach(k => {
        const tr = document.createElement('tr');
        let badge = `<span class="status-badge active">Active</span>`;
        if (k.skipped) badge = `<span class="status-badge skipped">Skipped</span>`;
        if (k.error) badge = `<span class="status-badge error">Error</span>`;

        tr.innerHTML = `
            <td><strong>${k.tenor}</strong></td>
            <td>${k.df !== undefined ? k.df.toFixed(5) : '-'}</td>
            <td>${k.zero_rate !== undefined ? k.zero_rate.toFixed(3) + '%' : '-'}</td>
            <td>${badge}</td>
        `;
        curve1KnotsTbody.appendChild(tr);
    });

    curve2KnotsTbody.innerHTML = '';
    knots2.forEach(k => {
        const tr = document.createElement('tr');
        let badge = `<span class="status-badge active">Active</span>`;
        if (k.skipped) badge = `<span class="status-badge skipped">Skipped</span>`;
        if (k.error) badge = `<span class="status-badge error">Error</span>`;

        tr.innerHTML = `
            <td><strong>${k.tenor}</strong></td>
            <td>${k.df !== undefined ? k.df.toFixed(5) : '-'}</td>
            <td>${k.zero_rate !== undefined ? k.zero_rate.toFixed(3) + '%' : '-'}</td>
            <td>${badge}</td>
        `;
        curve2KnotsTbody.appendChild(tr);
    });

    if (basisKnotsTbody && knotsBasis) {
        basisKnotsTbody.innerHTML = '';
        knotsBasis.forEach(k => {
            const tr = document.createElement('tr');
            let badge = `<span class="status-badge active">Active</span>`;
            if (k.skipped) badge = `<span class="status-badge skipped">Skipped</span>`;
            if (k.error) badge = `<span class="status-badge error">Error</span>`;

            tr.innerHTML = `
                <td><strong>${k.tenor}</strong></td>
                <td>${k.df !== undefined ? k.df.toFixed(5) : '-'}</td>
                <td>${k.zero_rate !== undefined ? k.zero_rate.toFixed(3) + '%' : '-'}</td>
                <td>${badge}</td>
            `;
            basisKnotsTbody.appendChild(tr);
        });
    }
}

function renderFXForwardTable(fxForward) {
    fxForwardTbody.innerHTML = '';
    fxForward.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${item.tenor}</strong></td>
            <td>${item.t.toFixed(4)}</td>
            <td style="font-family: monospace; font-weight: 600; color: var(--accent);">${item.forward_rate.toFixed(6)}</td>
        `;
        fxForwardTbody.appendChild(tr);
    });
}

// Chart.js render zero rate, discount factor, or FX forward curves
showZeroRateBtn.addEventListener('click', () => {
    if (currentChartType === 'zero_rate') return;
    currentChartType = 'zero_rate';
    showZeroRateBtn.classList.add('active');
    showDfBtn.classList.remove('active');
    if (showFxForwardBtn) showFxForwardBtn.classList.remove('active');
    renderCurvesChart();
});

showDfBtn.addEventListener('click', () => {
    if (currentChartType === 'discount_factor') return;
    currentChartType = 'discount_factor';
    showDfBtn.classList.add('active');
    showZeroRateBtn.classList.remove('active');
    if (showFxForwardBtn) showFxForwardBtn.classList.remove('active');
    renderCurvesChart();
});

if (showFxForwardBtn) {
    showFxForwardBtn.addEventListener('click', () => {
        if (currentChartType === 'fx_forward') return;
        currentChartType = 'fx_forward';
        showFxForwardBtn.classList.add('active');
        showZeroRateBtn.classList.remove('active');
        showDfBtn.classList.remove('active');
        renderCurvesChart();
    });
}

function renderCurvesChart() {
    if (!calculationResults) return;
    const canvas = document.getElementById('curves-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (curvesChart) curvesChart.destroy();

    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    const isDark = theme === 'dark';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
    const textColor = isDark ? '#94a3b8' : '#475569';

    const c1 = leg1Currency.value;
    const c2 = leg2Currency.value;

    let chartTitle = '';
    let yLabel = '';
    let datasets = [];

    const activeKnots1 = calculationResults.leg1_knots.filter(k => !k.error && !k.skipped && k.t > 0);
    const activeKnots2 = calculationResults.leg2_knots.filter(k => !k.error && !k.skipped && k.t > 0);
    const activeKnotsBasis = calculationResults.basis_knots ? calculationResults.basis_knots.filter(k => !k.error && !k.skipped && k.t > 0) : [];

    if (currentChartType === 'zero_rate') {
        chartTitle = 'Interest Rate Zero Curves (Smooth Spline)';
        yLabel = 'Continuous Zero Rate (%)';

        const dataset1 = calculationResults.leg1_curve.times.map((t, idx) => ({ x: t, y: calculationResults.leg1_curve.zero_rates[idx] }));
        const dataset2 = calculationResults.leg2_curve.times.map((t, idx) => ({ x: t, y: calculationResults.leg2_curve.zero_rates[idx] }));

        const knotsData1 = activeKnots1.map(k => ({ x: k.t, y: k.zero_rate, label: k.tenor }));
        const knotsData2 = activeKnots2.map(k => ({ x: k.t, y: k.zero_rate, label: k.tenor }));

        datasets = [
            {
                label: `${c1} Curve`,
                data: dataset1,
                showLine: true,
                borderColor: '#3b82f6', // USD blue
                borderWidth: 2.5,
                pointRadius: 0,
                fill: false,
                tension: 0.1
            },
            {
                label: `${c1} Nodes`,
                data: knotsData1,
                showLine: false,
                pointBackgroundColor: '#06b6d4',
                pointBorderColor: isDark ? '#070913' : '#ffffff',
                pointBorderWidth: 1.5,
                pointRadius: 5,
                z: 5
            },
            {
                label: `${c2} Curve`,
                data: dataset2,
                showLine: true,
                borderColor: '#f59e0b', // EUR orange
                borderWidth: 2.5,
                pointRadius: 0,
                fill: false,
                tension: 0.1
            },
            {
                label: `${c2} Nodes`,
                data: knotsData2,
                showLine: false,
                pointBackgroundColor: '#ef4444',
                pointBorderColor: isDark ? '#070913' : '#ffffff',
                pointBorderWidth: 1.5,
                pointRadius: 5,
                z: 5
            }
        ];

        if (calculationResults.basis_curve) {
            const datasetBasis = calculationResults.basis_curve.times.map((t, idx) => ({ x: t, y: calculationResults.basis_curve.zero_rates[idx] }));
            const knotsDataBasis = activeKnotsBasis.map(k => ({ x: k.t, y: k.zero_rate, label: k.tenor }));
            datasets.push(
                {
                    label: `${c2} Basis Curve`,
                    data: datasetBasis,
                    showLine: true,
                    borderColor: '#10b981', // green
                    borderWidth: 2.5,
                    pointRadius: 0,
                    fill: false,
                    tension: 0.1
                },
                {
                    label: `${c2} Basis Nodes`,
                    data: knotsDataBasis,
                    showLine: false,
                    pointBackgroundColor: '#34d399',
                    pointBorderColor: isDark ? '#070913' : '#ffffff',
                    pointBorderWidth: 1.5,
                    pointRadius: 5,
                    z: 5
                }
            );
        }
    } else if (currentChartType === 'discount_factor') {
        chartTitle = 'Discount Factor Curves';
        yLabel = 'Discount Factor D(0, T)';

        const dataset1 = calculationResults.leg1_curve.times.map((t, idx) => ({ x: t, y: calculationResults.leg1_curve.discount_factors[idx] }));
        const dataset2 = calculationResults.leg2_curve.times.map((t, idx) => ({ x: t, y: calculationResults.leg2_curve.discount_factors[idx] }));

        dataset1.unshift({ x: 0, y: 1.0 });
        dataset2.unshift({ x: 0, y: 1.0 });

        const knotsData1 = activeKnots1.map(k => ({ x: k.t, y: k.df, label: k.tenor }));
        const knotsData2 = activeKnots2.map(k => ({ x: k.t, y: k.df, label: k.tenor }));
        knotsData1.unshift({ x: 0, y: 1.0, label: 'Origin' });
        knotsData2.unshift({ x: 0, y: 1.0, label: 'Origin' });

        datasets = [
            {
                label: `${c1} Curve`,
                data: dataset1,
                showLine: true,
                borderColor: '#3b82f6',
                borderWidth: 2.5,
                pointRadius: 0,
                fill: false,
                tension: 0.1
            },
            {
                label: `${c1} Nodes`,
                data: knotsData1,
                showLine: false,
                pointBackgroundColor: '#06b6d4',
                pointBorderColor: isDark ? '#070913' : '#ffffff',
                pointBorderWidth: 1.5,
                pointRadius: 5,
                z: 5
            },
            {
                label: `${c2} Curve`,
                data: dataset2,
                showLine: true,
                borderColor: '#f59e0b',
                borderWidth: 2.5,
                pointRadius: 0,
                fill: false,
                tension: 0.1
            },
            {
                label: `${c2} Nodes`,
                data: knotsData2,
                showLine: false,
                pointBackgroundColor: '#ef4444',
                pointBorderColor: isDark ? '#070913' : '#ffffff',
                pointBorderWidth: 1.5,
                pointRadius: 5,
                z: 5
            }
        ];

        if (calculationResults.basis_curve) {
            const datasetBasis = calculationResults.basis_curve.times.map((t, idx) => ({ x: t, y: calculationResults.basis_curve.discount_factors[idx] }));
            const knotsDataBasis = activeKnotsBasis.map(k => ({ x: k.t, y: k.df, label: k.tenor }));
            datasetBasis.unshift({ x: 0, y: 1.0 });
            knotsDataBasis.unshift({ x: 0, y: 1.0, label: 'Origin' });
            datasets.push(
                {
                    label: `${c2} Basis Curve`,
                    data: datasetBasis,
                    showLine: true,
                    borderColor: '#10b981',
                    borderWidth: 2.5,
                    pointRadius: 0,
                    fill: false,
                    tension: 0.1
                },
                {
                    label: `${c2} Basis Nodes`,
                    data: knotsDataBasis,
                    showLine: false,
                    pointBackgroundColor: '#34d399',
                    pointBorderColor: isDark ? '#070913' : '#ffffff',
                    pointBorderWidth: 1.5,
                    pointRadius: 5,
                    z: 5
                }
            );
        }
    } else {
        chartTitle = 'FX Forward Curve (Covered Interest Parity)';
        yLabel = `Forward FX Rate (${c1}/${c2})`;

        const fxData = [...calculationResults.fx_forward_curve];
        fxData.sort((a, b) => a.t - b.t);

        const smoothData = fxData.map(item => ({ x: item.t, y: item.forward_rate }));
        smoothData.unshift({ x: 0, y: parseFloat(spotFxInput.value) || 1.0 });

        const knotData = fxData.map(item => ({ x: item.t, y: item.forward_rate, label: item.tenor }));
        knotData.unshift({ x: 0, y: parseFloat(spotFxInput.value) || 1.0, label: 'Spot' });

        datasets = [
            {
                label: `Forward FX Rate`,
                data: smoothData,
                showLine: true,
                borderColor: '#06b6d4', // Cyan
                borderWidth: 2.5,
                pointRadius: 0,
                fill: false,
                tension: 0.1
            },
            {
                label: 'Tenor Points',
                data: knotData,
                showLine: false,
                pointBackgroundColor: '#ef4444', // Red
                pointBorderColor: isDark ? '#070913' : '#ffffff',
                pointBorderWidth: 1.5,
                pointRadius: 5,
                z: 5
            }
        ];
    }

    curvesChart = new Chart(ctx, {
        type: 'scatter',
        data: { datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: chartTitle,
                    color: isDark ? '#f8fafc' : '#0f172a',
                    font: { family: 'Outfit', size: 16, weight: '600' }
                },
                legend: {
                    labels: { color: textColor, font: { family: 'Inter', size: 11 } }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const point = context.raw;
                            const t = point.x.toFixed(3);
                            const val = point.y.toFixed(5);
                            const unit = currentChartType === 'zero_rate' ? '%' : '';
                            return `${context.dataset.label}: t = ${t}y | Value = ${val}${unit}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    title: { display: true, text: 'Tenor Time (Years)', color: textColor, font: { family: 'Outfit', size: 12, weight: '600' } },
                    grid: { color: gridColor },
                    ticks: { color: textColor }
                },
                y: {
                    title: { display: true, text: yLabel, color: textColor, font: { family: 'Outfit', size: 12, weight: '600' } },
                    grid: { color: gridColor },
                    ticks: { color: textColor }
                }
            }
        }
    });
}

function renderTimelineChart() {
    if (!calculationResults || !calculationResults.cashflows) return;
    const canvas = document.getElementById('cashflow-timeline-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (timelineChart) timelineChart.destroy();

    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    const isDark = theme === 'dark';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
    const textColor = isDark ? '#94a3b8' : '#475569';

    // Process cashflows: group by date
    const interestCfs = calculationResults.cashflows.filter(cf => cf.type === 'interest');

    const labels = interestCfs.map(cf => cf.date);
    const leg1Flows = interestCfs.map(cf => cf.leg1_amount);
    const leg2Flows = interestCfs.map(cf => cf.leg2_converted); // converted to Currency 1

    // Net cumulative PV of interest payments
    let cumulative = 0.0;
    const cumulativeFlows = interestCfs.map(cf => {
        cumulative += cf.pv; // already discounted net cashflow in Leg 1 currency
        return cumulative;
    });

    timelineChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    type: 'line',
                    label: 'Cumulative Net PV (Interest)',
                    data: cumulativeFlows,
                    borderColor: '#10b981', // green
                    backgroundColor: 'rgba(16, 185, 129, 0.05)',
                    borderWidth: 3,
                    tension: 0.3,
                    fill: true,
                    yAxisID: 'y'
                },
                {
                    type: 'bar',
                    label: `Leg 1 Period Interest`,
                    data: leg1Flows,
                    backgroundColor: 'rgba(59, 130, 246, 0.65)', // Blue
                    barThickness: 6,
                    yAxisID: 'y'
                },
                {
                    type: 'bar',
                    label: `Leg 2 Period (Converted)`,
                    data: leg2Flows,
                    backgroundColor: 'rgba(245, 158, 11, 0.65)', // Orange
                    barThickness: 6,
                    yAxisID: 'y'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Cashflow Interest Projections & Cumulative Net PV',
                    color: isDark ? '#f8fafc' : '#0f172a',
                    font: { family: 'Outfit', size: 15, weight: '600' }
                },
                legend: {
                    labels: { color: textColor, font: { family: 'Inter', size: 11 } }
                }
            },
            scales: {
                x: {
                    grid: { color: gridColor },
                    ticks: { color: textColor, font: { family: 'Inter', size: 10 } }
                },
                y: {
                    grid: { color: gridColor },
                    ticks: { color: textColor, font: { family: 'Inter', size: 10 } },
                    title: { display: true, text: 'Value (Leg 1 Currency)', color: textColor, font: { family: 'Outfit', size: 12, weight: '600' } }
                }
            }
        }
    });
}

// Export cashflow table to CSV
exportCashflowsBtn.addEventListener('click', () => {
    if (!calculationResults || !calculationResults.cashflows) return;

    const c1 = leg1Currency.value;
    const c2 = leg2Currency.value;

    let csvContent = `PaymentDate,Type,Leg1_Cashflow_${c1},Leg2_Cashflow_${c2},ForwardFXRate,Leg2_Converted_${c1},Net_Cashflow_${c1},DiscountFactor_${c1},PV_Net_Cashflow_${c1}\n`;

    calculationResults.cashflows.forEach(cf => {
        csvContent += `${cf.date},${cf.type},${cf.leg1_amount},${cf.leg2_amount},${cf.fx_forward},${cf.leg2_converted},${cf.net_cashflow},${cf.df},${cf.pv}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `currency_swap_cashflows_${leg1Currency.value}_${leg2Currency.value}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// Toggle Curve & Forward Tables Logic
if (showCurve1TableBtn && showCurve2TableBtn && showBasisTableBtn && showFxTableBtn) {
    showCurve1TableBtn.addEventListener('click', () => {
        showCurve1TableBtn.classList.add('active');
        showCurve2TableBtn.classList.remove('active');
        showBasisTableBtn.classList.remove('active');
        showFxTableBtn.classList.remove('active');

        curve1TableWrapper.style.display = 'block';
        curve2TableWrapper.style.display = 'none';
        basisTableWrapper.style.display = 'none';
        fxTableWrapper.style.display = 'none';
    });

    showCurve2TableBtn.addEventListener('click', () => {
        showCurve1TableBtn.classList.remove('active');
        showCurve2TableBtn.classList.add('active');
        showBasisTableBtn.classList.remove('active');
        showFxTableBtn.classList.remove('active');

        curve1TableWrapper.style.display = 'none';
        curve2TableWrapper.style.display = 'block';
        basisTableWrapper.style.display = 'none';
        fxTableWrapper.style.display = 'none';
    });

    showBasisTableBtn.addEventListener('click', () => {
        showCurve1TableBtn.classList.remove('active');
        showCurve2TableBtn.classList.remove('active');
        showBasisTableBtn.classList.add('active');
        showFxTableBtn.classList.remove('active');

        curve1TableWrapper.style.display = 'none';
        curve2TableWrapper.style.display = 'none';
        basisTableWrapper.style.display = 'block';
        fxTableWrapper.style.display = 'none';
    });

    showFxTableBtn.addEventListener('click', () => {
        showCurve1TableBtn.classList.remove('active');
        showCurve2TableBtn.classList.remove('active');
        showBasisTableBtn.classList.remove('active');
        showFxTableBtn.classList.add('active');

        curve1TableWrapper.style.display = 'none';
        curve2TableWrapper.style.display = 'none';
        basisTableWrapper.style.display = 'none';
        fxTableWrapper.style.display = 'block';
    });
}

// P&L Attribution & Scenario Calculator Logic
function updatePnlAttribution() {
    if (!calculationResults || !calculationResults.risk_results) return;

    const c1 = leg1Currency.value;
    const risk = calculationResults.risk_results;
    
    // 1. Leg 1 Rate P&L
    let leg1Pnl = 0.0;
    document.querySelectorAll('#leg1-delta-tbody .pnl-move-input').forEach(input => {
        const move = parseFloat(input.value) || 0.0;
        const delta = parseFloat(input.dataset.delta) || 0.0;
        leg1Pnl += move * delta;
    });

    // 2. Leg 2 Rate P&L
    let leg2Pnl = 0.0;
    document.querySelectorAll('#leg2-delta-tbody .pnl-move-input').forEach(input => {
        const move = parseFloat(input.value) || 0.0;
        const delta = parseFloat(input.dataset.delta) || 0.0;
        leg2Pnl += move * delta;
    });

    // 3. Basis Curve P&L
    let basisPnl = 0.0;
    document.querySelectorAll('#basis-delta-tbody .pnl-move-input').forEach(input => {
        const move = parseFloat(input.value) || 0.0;
        const delta = parseFloat(input.dataset.delta) || 0.0;
        basisPnl += move * delta;
    });

    // 4. FX Spot P&L
    const fxMove = parseFloat(document.getElementById('pnl-fx-bump').value) || 0.0;
    const fxDelta = risk.parallel.fx_delta_1pct; // sensitivity for +1% relative move
    const fxPnl = fxMove * fxDelta;

    // Sum total
    const totalPnl = leg1Pnl + leg2Pnl + basisPnl + fxPnl;

    // Display formatted results
    const formatPnlText = (val) => {
        const prefix = val >= 0 ? '+' : '-';
        const absVal = Math.abs(val);
        return `${prefix}${c1} ${absVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    document.getElementById('pnl-leg1-contrib').textContent = formatPnlText(leg1Pnl);
    document.getElementById('pnl-leg2-contrib').textContent = formatPnlText(leg2Pnl);
    document.getElementById('pnl-basis-contrib').textContent = formatPnlText(basisPnl);
    document.getElementById('pnl-fx-contrib').textContent = formatPnlText(fxPnl);

    const totalEl = document.getElementById('pnl-total-impact');
    totalEl.textContent = formatPnlText(totalPnl);
    
    // Style total text color based on sign
    if (totalPnl >= 0) {
        totalEl.style.color = 'var(--success)';
        totalEl.style.textShadow = '0 0 10px rgba(16,185,129,0.25)';
    } else {
        totalEl.style.color = 'var(--danger)';
        totalEl.style.textShadow = '0 0 10px rgba(239,68,68,0.25)';
    }
}

// Global listeners for P&L widget interactions
document.addEventListener('input', (e) => {
    if (e.target.classList.contains('pnl-move-input') || e.target.id === 'pnl-fx-bump') {
        updatePnlAttribution();
    }
});

document.addEventListener('click', (e) => {
    if (e.target.id === 'pnl-reset-btn') {
        document.querySelectorAll('.pnl-move-input').forEach(input => input.value = "0.0");
        const fxInput = document.getElementById('pnl-fx-bump');
        if (fxInput) fxInput.value = "0.0";
        updatePnlAttribution();
    } else if (e.target.id === 'pnl-shift-leg1-btn') {
        document.querySelectorAll('#leg1-delta-tbody .pnl-move-input').forEach(input => input.value = "1.0");
        updatePnlAttribution();
    } else if (e.target.id === 'pnl-shift-leg2-btn') {
        document.querySelectorAll('#leg2-delta-tbody .pnl-move-input').forEach(input => input.value = "1.0");
        updatePnlAttribution();
    } else if (e.target.id === 'pnl-shift-basis-btn') {
        document.querySelectorAll('#basis-delta-tbody .pnl-move-input').forEach(input => input.value = "1.0");
        updatePnlAttribution();
    }
});
