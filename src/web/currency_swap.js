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
const leg1Type = document.getElementById('leg1-type');
const leg1Rate = document.getElementById('leg1-rate');
const leg1Notional = document.getElementById('leg1-notional');
const leg1Frequency = document.getElementById('leg1-frequency');
const leg1Daycount = document.getElementById('leg1-daycount');
const leg1Tenor = document.getElementById('leg1-tenor');

// Leg 2 Elements
const leg2Currency = document.getElementById('leg2-currency');
const leg2Type = document.getElementById('leg2-type');
const leg2Rate = document.getElementById('leg2-rate');
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
const curve2Dropzone = document.getElementById('curve2-dropzone');
const curve2FileInput = document.getElementById('curve2-file');
const basisDropzone = document.getElementById('basis-dropzone');
const basisFileInput = document.getElementById('basis-file');

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

function updateRateTypeUI(legNum, selectElement) {
    const floatInputs = document.getElementById(`leg${legNum}-float-inputs`);
    const fixedInputs = document.getElementById(`leg${legNum}-fixed-inputs`);
    
    if (!floatInputs || !fixedInputs) return;

    if (selectElement.value === 'floating') {
        floatInputs.style.display = 'flex';
        fixedInputs.style.display = 'none';
    } else {
        floatInputs.style.display = 'none';
        fixedInputs.style.display = 'flex';
    }
}

if (leg1Type) leg1Type.addEventListener('change', (e) => updateRateTypeUI(1, e.target));
if (leg2Type) leg2Type.addEventListener('change', (e) => updateRateTypeUI(2, e.target));

const btnLoadCurve1 = document.getElementById('btn-load-curve1');
const btnLoadCurve2 = document.getElementById('btn-load-curve2');

if (btnLoadCurve1) {
    btnLoadCurve1.addEventListener('click', () => {
        const dropzoneUI = document.getElementById('curve1-dropzone-ui');
        const ccy = leg1Currency ? leg1Currency.value : 'USD';
        if (dropzoneUI) {
            dropzoneUI.innerHTML = `
                <div style="background: rgba(34, 197, 94, 0.1); border: 1px solid #22c55e; border-radius: 8px; padding: 30px; text-align: center; min-height: 120px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                    <i class="fa-solid fa-circle-check" style="color: #22c55e; font-size: 32px; margin-bottom: 10px;"></i>
                    <h3 style="color: #22c55e; margin: 0; font-size: 16px;">OIS ${ccy} Curve Loaded</h3>
                    <p style="color: var(--text-muted); font-size: 12px; margin-top: 5px;">Using default sample data.</p>
                </div>
            `;
        }
        curve1MarketQuotes = [];
        showAlert(`Default ${ccy} Curve successfully applied.`, 'success');
    });
}

if (btnLoadCurve2) {
    btnLoadCurve2.addEventListener('click', () => {
        const dropzoneUI = document.getElementById('curve2-dropzone-ui');
        const ccy = leg2Currency ? leg2Currency.value : 'EUR';
        if (dropzoneUI) {
            dropzoneUI.innerHTML = `
                <div style="background: rgba(34, 197, 94, 0.1); border: 1px solid #22c55e; border-radius: 8px; padding: 30px; text-align: center; min-height: 120px; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                    <i class="fa-solid fa-circle-check" style="color: #22c55e; font-size: 32px; margin-bottom: 10px;"></i>
                    <h3 style="color: #22c55e; margin: 0; font-size: 16px;">${ccy} Curve Loaded</h3>
                    <p style="color: var(--text-muted); font-size: 12px; margin-top: 5px;">Using default sample data.</p>
                </div>
            `;
        }
        curve2MarketQuotes = [];
        showAlert(`Default ${ccy} Curve successfully applied.`, 'success');
    });
}

// Initial Setup
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    if (leg1Notional) initNotionalFormatting(leg1Notional);
    if (leg2Notional) initNotionalFormatting(leg2Notional);
    initSyncingListeners();
    updateLabelStates();

    const toggleTableBtn = document.getElementById('toggle-cashflow-table');
    const cashflowsTable = document.getElementById('cashflows-table');
    const cashflowGridRow = document.getElementById('cashflow-grid-row');
    let isTableExpanded = true;

    if (toggleTableBtn && cashflowsTable && cashflowGridRow) {
        toggleTableBtn.addEventListener('click', () => {
            isTableExpanded = !isTableExpanded;
            
            if (isTableExpanded) {
                cashflowGridRow.style.gridTemplateColumns = '2fr 3fr';
                cashflowsTable.classList.remove('table-collapsed');
                toggleTableBtn.innerHTML = '<i class="fa-solid fa-compress"></i>';
                toggleTableBtn.title = 'Hide extra data';
            } else {
                cashflowGridRow.style.gridTemplateColumns = '3fr 2fr';
                cashflowsTable.classList.add('table-collapsed');
                toggleTableBtn.innerHTML = '<i class="fa-solid fa-expand"></i>';
                toggleTableBtn.title = 'Expand hidden data';
            }

            setTimeout(() => {
                if (typeof timelineChart !== 'undefined' && timelineChart) timelineChart.resize();
            }, 400);
        });
    }
});

function formatWithCommas(value) {
    if (!value) return '';
    let num = String(value).replace(/[^0-9.]/g, '');
    if (!num) return '';
    let parts = num.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
}

function stripCommas(value) {
    if (!value) return 0.0;
    return parseFloat(String(value).replace(/,/g, '')) || 0.0;
}

function initNotionalFormatting(input) {
    input.addEventListener('input', (e) => {
        e.target.value = formatWithCommas(e.target.value);
    });
    input.value = formatWithCommas(input.value);
}

function formatDateShort(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`;
}

function updateLabelStates() {
    const c1 = leg1Currency ? leg1Currency.value : 'USD';
    const c2 = leg2Currency ? leg2Currency.value : 'EUR';

    if (fxPairLabel) fxPairLabel.textContent = `${c1}/${c2}`;
    if (curve1Name) curve1Name.textContent = c1;
    if (curve2Name) curve2Name.textContent = c2;
    if (basisPairName) basisPairName.textContent = `${c2}/${c1}`;
    if (curve1NodesTitle) curve1NodesTitle.textContent = c1;
    if (curve2NodesTitle) curve2NodesTitle.textContent = c2;

    document.querySelectorAll('.leg1-curr-label').forEach(el => el.textContent = c1);
    document.querySelectorAll('.leg2-curr-label').forEach(el => el.textContent = c2);

    if (curve1TabLabel) curve1TabLabel.textContent = `${c1} Nodes`;
    if (curve2TabLabel) curve2TabLabel.textContent = `${c2} Nodes`;
    if (basisTabLabel) basisTabLabel.textContent = `${c2} Basis Nodes`;
}

function initSyncingListeners() {
    if (leg1Currency) leg1Currency.addEventListener('change', updateLabelStates);
    if (leg2Currency) leg2Currency.addEventListener('change', updateLabelStates);

    if (leg1Tenor && leg2Tenor) {
        leg1Tenor.addEventListener('input', (e) => {
            leg2Tenor.value = e.target.value;
        });
    }

    if (recalcNotionalBtn && spotFxInput && leg1Notional && leg2Notional) {
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
}

function safeAddDragDrop(dropzoneEl, inputEl, curveNum) {
    if (!dropzoneEl || !inputEl) return;
    dropzoneEl.addEventListener('click', () => inputEl.click());
    dropzoneEl.addEventListener('dragover', (e) => { e.preventDefault(); dropzoneEl.classList.add('dragover'); });
    dropzoneEl.addEventListener('dragleave', () => dropzoneEl.classList.remove('dragover'));
    dropzoneEl.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzoneEl.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) handleCurveFile(e.dataTransfer.files[0], curveNum);
    });
    inputEl.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleCurveFile(e.target.files[0], curveNum);
    });
}

safeAddDragDrop(curve1Dropzone, curve1FileInput, 1);
safeAddDragDrop(curve2Dropzone, curve2FileInput, 2);
safeAddDragDrop(basisDropzone, basisFileInput, 3);

function setStatusHTML(curveNum, html) {
    let el;
    if (curveNum === 1) el = document.getElementById('curve1-status');
    else if (curveNum === 2) el = document.getElementById('curve2-status');
    else el = document.getElementById('basis-status');
    if (el) el.innerHTML = html;
}

function handleCurveFile(file, curveNum) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const parsed = parseCSV(e.target.result);
            if (parsed.length > 0) {
                const successMsg = `<span style="color: var(--success); font-weight: 600;"><i class="fa-solid fa-circle-check"></i> Loaded ${parsed.length} quotes from ${file.name}</span>`;
                if (curveNum === 1) {
                    curve1MarketQuotes = parsed;
                    setStatusHTML(1, successMsg);
                } else if (curveNum === 2) {
                    curve2MarketQuotes = parsed;
                    setStatusHTML(2, successMsg);
                } else {
                    basisMarketQuotes = parsed;
                    setStatusHTML(3, successMsg);
                }
                showAlert(`Curve market data successfully loaded!`, 'success');
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

if (resetCurvesBtn) {
    resetCurvesBtn.addEventListener('click', () => {
        curve1MarketQuotes = [];
        curve2MarketQuotes = [];
        basisMarketQuotes = [];
        setStatusHTML(1, 'Using default USD OIS curve sample data.');
        setStatusHTML(2, 'Using default EUR curve sample data.');
        setStatusHTML(3, 'Using default EUR/USD market basis curve sample data.');
        if (curve1FileInput) curve1FileInput.value = '';
        if (curve2FileInput) curve2FileInput.value = '';
        if (basisFileInput) basisFileInput.value = '';
        showAlert('Reset back to default sample curves.', 'info');
        triggerCalculation();
    });
}

function showAlert(message, type = 'info') {
    if (!alertContainer) return;
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    let iconClass = 'fa-circle-info';
    if (type === 'danger') iconClass = 'fa-circle-xmark';
    if (type === 'success') iconClass = 'fa-circle-check';

    alertDiv.innerHTML = `<i class="fa-solid ${iconClass}"></i> <span>${message}</span>`;
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

if (themeToggleBtn) {
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
}

function updateThemeIcon(theme) {
    if (!themeToggleBtn) return;
    const icon = themeToggleBtn.querySelector('i');
    if (icon) icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}

if (calculateBtn) calculateBtn.addEventListener('click', triggerCalculation);

async function triggerCalculation() {
    if (!calculateBtn) return;

    try {
        calculateBtn.disabled = true;
        calculateBtn.innerHTML = `<span class="spinner"></span> Pricing Swap...`;

        const tradeDate = tradeDateInput ? tradeDateInput.value.trim() : '28-05-2026';
        const spotFx = spotFxInput ? (parseFloat(spotFxInput.value) || 1.0) : 1.0;

        const leg1RateOrSpread = (leg1Type && leg1Type.value === 'fixed') 
            ? (parseFloat(document.getElementById('leg1-rate')?.value) || 0.0) 
            : (parseFloat(document.getElementById('leg1-spread')?.value) || 0.0);

        const leg1 = {
            currency: leg1Currency ? leg1Currency.value : 'USD',
            notional: leg1Notional ? stripCommas(leg1Notional.value) : 10000000,
            rate_type: leg1Type ? leg1Type.value : 'floating',
            rate_or_spread: leg1RateOrSpread,
            frequency: leg1Frequency ? parseInt(leg1Frequency.value) : 2,
            day_count: leg1Daycount ? leg1Daycount.value : 'ACT/365',
            tenor_years: leg1Tenor ? parseInt(leg1Tenor.value) : 5,
            is_payer: false 
        };

        const leg2RateOrSpread = (leg2Type && leg2Type.value === 'fixed') 
            ? (parseFloat(document.getElementById('leg2-rate')?.value) || 0.0) 
            : (parseFloat(document.getElementById('leg2-spread')?.value) || 0.0);

        const leg2 = {
            currency: leg2Currency ? leg2Currency.value : 'EUR',
            notional: leg2Notional ? stripCommas(leg2Notional.value) : 10000000,
            rate_type: leg2Type ? leg2Type.value : 'fixed',
            rate_or_spread: leg2RateOrSpread,
            frequency: leg2Frequency ? parseInt(leg2Frequency.value) : 2,
            day_count: leg2Daycount ? leg2Daycount.value : 'ACT/360',
            tenor_years: leg1Tenor ? parseInt(leg1Tenor.value) : 5, 
            is_payer: true 
        };

        const curve_config1 = {
            day_count_convention: leg1Daycount ? leg1Daycount.value : 'ACT/365',
            payment_frequency: leg1Frequency ? parseInt(leg1Frequency.value) : 2,
            interpolation_method: document.getElementById('curve1-interpolation')?.value || 'Cubic Spline',
            futures_cutoff_years: parseFloat(document.getElementById('curve1-cutoff')?.value) || 2.0
        };

        const curve_config2 = {
            day_count_convention: leg2Daycount ? leg2Daycount.value : 'ACT/360',
            payment_frequency: leg2Frequency ? parseInt(leg2Frequency.value) : 2,
            interpolation_method: document.getElementById('curve2-interpolation')?.value || 'Cubic Spline',
            futures_cutoff_years: parseFloat(document.getElementById('curve2-cutoff')?.value) || 2.0
        };

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
            if (resultsContainer) resultsContainer.style.display = 'none';
        } else {
            calculationResults = data;
            if (resultsContainer) resultsContainer.style.display = 'grid';
            showAlert('Cross-currency swap valued successfully!', 'success');

            updateNPVDisplays(data.npv_results);
            renderRiskResults(data.risk_results);
            renderCashflowTable(data.cashflows);
            renderKnotTables(data.leg1_knots, data.leg2_knots, data.basis_knots);
            renderFXForwardTable(data.fx_forward_curve);

            renderCurvesChart();
            renderTimelineChart();

            if (resultsContainer) resultsContainer.scrollIntoView({ behavior: 'smooth' });
        }
    } catch (err) {
        showAlert(`Frontend/Server error: ${err.message}`, 'danger');
    } finally {
        if (calculateBtn) {
            calculateBtn.disabled = false;
            calculateBtn.innerHTML = `<i class="fa-solid fa-bolt"></i> Calculate Swap Price & NPV`;
        }
    }
}

function formatRiskAmount(value, currency) {
    if (value === null || value === undefined) return '—';
    const prefix = value >= 0 ? '+' : '';
    return `${prefix}${currency} ${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function renderRiskResults(risk) {
    if (!risk || !risk.parallel) return;

    const c1 = leg1Currency ? leg1Currency.value : 'USD';
    const p = risk.parallel;

    const el1 = document.getElementById('risk-leg1-dv01');
    const el2 = document.getElementById('risk-leg2-dv01');
    const elB = document.getElementById('risk-basis-dv01');
    
    if (el1) el1.textContent = formatRiskAmount(p.leg1_dv01, c1);
    if (el2) el2.textContent = formatRiskAmount(p.leg2_dv01, c1);
    if (elB) elB.textContent = formatRiskAmount(p.basis_dv01, c1);

    const fxEl = document.getElementById('risk-fx-delta');
    if (fxEl) {
        const fxDelta = p.fx_delta_1pct;
        fxEl.textContent = `${fxDelta >= 0 ? '+' : '-'}${c1} ${Math.abs(fxDelta).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        fxEl.style.color = fxDelta >= 0 ? 'var(--success)' : 'var(--danger)';
    }

    const leg1SpreadWrap = document.getElementById('risk-leg1-spread-wrap');
    const leg2SpreadWrap = document.getElementById('risk-leg2-spread-wrap');
    const riskLeg1Spread = document.getElementById('risk-leg1-spread');
    const riskLeg2Spread = document.getElementById('risk-leg2-spread');
    
    if (leg1SpreadWrap && riskLeg1Spread) {
        if (p.leg1_spread_pvbp != null) {
            leg1SpreadWrap.style.display = 'block';
            riskLeg1Spread.textContent = formatRiskAmount(p.leg1_spread_pvbp, c1);
        } else {
            leg1SpreadWrap.style.display = 'none';
        }
    }
    
    if (leg2SpreadWrap && riskLeg2Spread) {
        if (p.leg2_spread_pvbp != null) {
            leg2SpreadWrap.style.display = 'block';
            riskLeg2Spread.textContent = formatRiskAmount(p.leg2_spread_pvbp, c1);
        } else {
            leg2SpreadWrap.style.display = 'none';
        }
    }

    const methodNote = document.getElementById('risk-method-note');
    if (methodNote && risk.method) {
        methodNote.textContent = `Rate bumps: ${risk.method.rate_bump}. FX: ${risk.method.fx_bump}. Spread: ${risk.method.spread_bump}. All ΔNPV in ${c1}.`;
    }

    renderDeltaVectorTable('leg1-delta-tbody', risk.leg1_delta_vector || [], c1);
    renderDeltaVectorTable('leg2-delta-tbody', risk.leg2_delta_vector || [], c1);
    renderDeltaVectorTable('basis-delta-tbody', risk.basis_delta_vector || [], c1);
    
    document.querySelectorAll('.pnl-move-input').forEach(input => input.value = "0.0");
    const fxInput = document.getElementById('pnl-fx-bump');
    if (fxInput) fxInput.value = "0.0";
    
    updatePnlAttribution();
}

function renderDeltaVectorTable(tbodyId, rows, currency) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
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
    const c1 = leg1Currency ? leg1Currency.value : 'USD';

    const l1i = document.getElementById('leg1-interest-pv-display');
    const l1n = document.getElementById('leg1-notional-pv-display');
    const l1t = document.getElementById('leg1-total-pv-display');
    if (l1i) l1i.textContent = `Interest PV: ${c1} ${results.leg1_interest_pv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (l1n) l1n.textContent = `Notional PV: ${c1} ${results.leg1_notional_pv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (l1t) l1t.textContent = `${c1} ${results.leg1_total_pv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const l2i = document.getElementById('leg2-interest-pv-display');
    const l2n = document.getElementById('leg2-notional-pv-display');
    const l2t = document.getElementById('leg2-total-pv-display');
    if (l2i) l2i.textContent = `Interest PV: ${c1} ${results.leg2_interest_pv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (l2n) l2n.textContent = `Notional PV: ${c1} ${results.leg2_notional_pv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (l2t) l2t.textContent = `${c1} ${results.leg2_total_pv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const netNPV = document.getElementById('net-npv-display');
    if (netNPV) {
        netNPV.textContent = `${c1} ${results.total_net_npv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        if (results.total_net_npv >= 0.0) {
            netNPV.style.color = 'var(--success)';
            netNPV.style.textShadow = '0 0 10px rgba(16,185,129,0.25)';
        } else {
            netNPV.style.color = 'var(--danger)';
            netNPV.style.textShadow = '0 0 10px rgba(239,68,68,0.25)';
        }
    }
}

function renderCashflowTable(cashflows) {
    if (!cashflowsTbody) return;
    cashflowsTbody.innerHTML = '';
    cashflows.forEach(cf => {
        const tr = document.createElement('tr');
        if (cf.type === 'principal') {
            tr.style.background = 'rgba(255, 255, 255, 0.04)';
            tr.style.fontWeight = 'bold';
        }

        const l1Color = cf.leg1_amount >= 0 ? 'color: #06b6d4;' : 'color: var(--danger);'; 
        const l2Color = cf.leg2_amount >= 0 ? 'color: #f59e0b;' : 'color: var(--danger);'; 
        const netColor = cf.net_cashflow >= 0 ? 'color: var(--success);' : 'color: var(--danger);';

        tr.innerHTML = `
            <td>${formatDateShort(cf.date)}</td>
            <td class="col-hideable"><span class="status-badge ${cf.type === 'principal' ? 'active' : 'skipped'}">${cf.type.toUpperCase()}</span></td>
            <td style="${l1Color}">${cf.leg1_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td class="col-hideable" style="${l2Color}">${cf.leg2_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td>${cf.fx_forward.toFixed(4)}</td>
            <td style="${l2Color}">${cf.leg2_converted.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td style="${netColor}">${cf.net_cashflow.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td>${cf.df.toFixed(4)}</td>
            <td style="${netColor} font-weight: bold;">${cf.pv.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
        `;
        cashflowsTbody.appendChild(tr);
    });
}

function renderKnotTables(knots1, knots2, knotsBasis) {
    if (curve1KnotsTbody && knots1) {
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
    }

    if (curve2KnotsTbody && knots2) {
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
    }

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
    if (!fxForwardTbody) return;
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

if (showZeroRateBtn) {
    showZeroRateBtn.addEventListener('click', () => {
        if (currentChartType === 'zero_rate') return;
        currentChartType = 'zero_rate';
        showZeroRateBtn.classList.add('active');
        if (showDfBtn) showDfBtn.classList.remove('active');
        if (showFxForwardBtn) showFxForwardBtn.classList.remove('active');
        renderCurvesChart();
    });
}

if (showDfBtn) {
    showDfBtn.addEventListener('click', () => {
        if (currentChartType === 'discount_factor') return;
        currentChartType = 'discount_factor';
        showDfBtn.classList.add('active');
        if (showZeroRateBtn) showZeroRateBtn.classList.remove('active');
        if (showFxForwardBtn) showFxForwardBtn.classList.remove('active');
        renderCurvesChart();
    });
}

if (showFxForwardBtn) {
    showFxForwardBtn.addEventListener('click', () => {
        if (currentChartType === 'fx_forward') return;
        currentChartType = 'fx_forward';
        showFxForwardBtn.classList.add('active');
        if (showZeroRateBtn) showZeroRateBtn.classList.remove('active');
        if (showDfBtn) showDfBtn.classList.remove('active');
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

    const c1 = leg1Currency ? leg1Currency.value : 'USD';
    const c2 = leg2Currency ? leg2Currency.value : 'EUR';

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
            { label: `${c1} Curve`, data: dataset1, showLine: true, borderColor: '#3b82f6', borderWidth: 2.5, pointRadius: 0, fill: false, tension: 0.1 },
            { label: `${c1} Nodes`, data: knotsData1, showLine: false, pointBackgroundColor: '#06b6d4', pointBorderColor: isDark ? '#070913' : '#ffffff', pointBorderWidth: 1.5, pointRadius: 5, z: 5 },
            { label: `${c2} Curve`, data: dataset2, showLine: true, borderColor: '#f59e0b', borderWidth: 2.5, pointRadius: 0, fill: false, tension: 0.1 },
            { label: `${c2} Nodes`, data: knotsData2, showLine: false, pointBackgroundColor: '#ef4444', pointBorderColor: isDark ? '#070913' : '#ffffff', pointBorderWidth: 1.5, pointRadius: 5, z: 5 }
        ];

        if (calculationResults.basis_curve) {
            const datasetBasis = calculationResults.basis_curve.times.map((t, idx) => ({ x: t, y: calculationResults.basis_curve.zero_rates[idx] }));
            const knotsDataBasis = activeKnotsBasis.map(k => ({ x: k.t, y: k.zero_rate, label: k.tenor }));
            datasets.push(
                { label: `${c2} Basis Curve`, data: datasetBasis, showLine: true, borderColor: '#10b981', borderWidth: 2.5, pointRadius: 0, fill: false, tension: 0.1 },
                { label: `${c2} Basis Nodes`, data: knotsDataBasis, showLine: false, pointBackgroundColor: '#34d399', pointBorderColor: isDark ? '#070913' : '#ffffff', pointBorderWidth: 1.5, pointRadius: 5, z: 5 }
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
            { label: `${c1} Curve`, data: dataset1, showLine: true, borderColor: '#3b82f6', borderWidth: 2.5, pointRadius: 0, fill: false, tension: 0.1 },
            { label: `${c1} Nodes`, data: knotsData1, showLine: false, pointBackgroundColor: '#06b6d4', pointBorderColor: isDark ? '#070913' : '#ffffff', pointBorderWidth: 1.5, pointRadius: 5, z: 5 },
            { label: `${c2} Curve`, data: dataset2, showLine: true, borderColor: '#f59e0b', borderWidth: 2.5, pointRadius: 0, fill: false, tension: 0.1 },
            { label: `${c2} Nodes`, data: knotsData2, showLine: false, pointBackgroundColor: '#ef4444', pointBorderColor: isDark ? '#070913' : '#ffffff', pointBorderWidth: 1.5, pointRadius: 5, z: 5 }
        ];

        if (calculationResults.basis_curve) {
            const datasetBasis = calculationResults.basis_curve.times.map((t, idx) => ({ x: t, y: calculationResults.basis_curve.discount_factors[idx] }));
            const knotsDataBasis = activeKnotsBasis.map(k => ({ x: k.t, y: k.df, label: k.tenor }));
            datasetBasis.unshift({ x: 0, y: 1.0 });
            knotsDataBasis.unshift({ x: 0, y: 1.0, label: 'Origin' });
            datasets.push(
                { label: `${c2} Basis Curve`, data: datasetBasis, showLine: true, borderColor: '#10b981', borderWidth: 2.5, pointRadius: 0, fill: false, tension: 0.1 },
                { label: `${c2} Basis Nodes`, data: knotsDataBasis, showLine: false, pointBackgroundColor: '#34d399', pointBorderColor: isDark ? '#070913' : '#ffffff', pointBorderWidth: 1.5, pointRadius: 5, z: 5 }
            );
        }
    } else {
        chartTitle = 'FX Forward Curve (Covered Interest Parity)';
        yLabel = `Forward FX Rate (${c1}/${c2})`;

        const fxData = [...calculationResults.fx_forward_curve];
        fxData.sort((a, b) => a.t - b.t);

        const smoothData = fxData.map(item => ({ x: item.t, y: item.forward_rate }));
        const currentFx = spotFxInput ? parseFloat(spotFxInput.value) || 1.0 : 1.0;
        smoothData.unshift({ x: 0, y: currentFx });

        const knotData = fxData.map(item => ({ x: item.t, y: item.forward_rate, label: item.tenor }));
        knotData.unshift({ x: 0, y: currentFx, label: 'Spot' });

        datasets = [
            { label: `Forward FX Rate`, data: smoothData, showLine: true, borderColor: '#06b6d4', borderWidth: 2.5, pointRadius: 0, fill: false, tension: 0.1 },
            { label: 'Tenor Points', data: knotData, showLine: false, pointBackgroundColor: '#ef4444', pointBorderColor: isDark ? '#070913' : '#ffffff', pointBorderWidth: 1.5, pointRadius: 5, z: 5 }
        ];
    }

    curvesChart = new Chart(ctx, {
        type: 'scatter',
        data: { datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: chartTitle, color: isDark ? '#f8fafc' : '#0f172a', font: { family: 'Outfit', size: 16, weight: '600' } },
                legend: { labels: { color: textColor, font: { family: 'Inter', size: 11 } } },
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
                x: { type: 'linear', title: { display: true, text: 'Tenor Time (Years)', color: textColor, font: { family: 'Outfit', size: 12, weight: '600' } }, grid: { color: gridColor }, ticks: { color: textColor } },
                y: { title: { display: true, text: yLabel, color: textColor, font: { family: 'Outfit', size: 12, weight: '600' } }, grid: { color: gridColor }, ticks: { color: textColor } }
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

    const interestCfs = calculationResults.cashflows.filter(cf => cf.type === 'interest');

    const labels = interestCfs.map(cf => formatDateShort(cf.date));
    const leg1Flows = interestCfs.map(cf => cf.leg1_amount);
    const leg2Flows = interestCfs.map(cf => cf.leg2_converted);

    let cumulative = 0.0;
    const cumulativeFlows = interestCfs.map(cf => {
        cumulative += cf.pv;
        return cumulative;
    });

    timelineChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { type: 'line', label: 'Cumulative Net PV (Interest)', data: cumulativeFlows, borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.05)', borderWidth: 3, tension: 0.3, fill: true, yAxisID: 'y' },
                { type: 'bar', label: `Leg 1 Period Interest`, data: leg1Flows, backgroundColor: 'rgba(6, 182, 212, 0.75)', barThickness: 6, yAxisID: 'y' },
                { type: 'bar', label: `Leg 2 Period (Converted)`, data: leg2Flows, backgroundColor: 'rgba(245, 158, 11, 0.75)', barThickness: 6, yAxisID: 'y' }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: 'Cashflow Interest Projections & Cumulative Net PV', color: isDark ? '#f8fafc' : '#0f172a', font: { family: 'Outfit', size: 15, weight: '600' } },
                legend: { labels: { color: textColor, font: { family: 'Inter', size: 11 } } }
            },
            scales: {
                x: { grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'Inter', size: 10 } } },
                y: { grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'Inter', size: 10 } }, title: { display: true, text: 'Value (Leg 1 Currency)', color: textColor, font: { family: 'Outfit', size: 12, weight: '600' } } }
            }
        }
    });
}

if (exportCashflowsBtn) {
    exportCashflowsBtn.addEventListener('click', () => {
        if (!calculationResults || !calculationResults.cashflows) return;

        const c1 = leg1Currency ? leg1Currency.value : 'USD';
        const c2 = leg2Currency ? leg2Currency.value : 'EUR';

        let csvContent = `PaymentDate,Type,Leg1_Cashflow_${c1},Leg2_Cashflow_${c2},ForwardFXRate,Leg2_Converted_${c1},Net_Cashflow_${c1},DiscountFactor_${c1},PV_Net_Cashflow_${c1}\n`;

        calculationResults.cashflows.forEach(cf => {
            csvContent += `${cf.date},${cf.type},${cf.leg1_amount},${cf.leg2_amount},${cf.fx_forward},${cf.leg2_converted},${cf.net_cashflow},${cf.df},${cf.pv}\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `currency_swap_cashflows_${c1}_${c2}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}

if (showCurve1TableBtn && showCurve2TableBtn && showBasisTableBtn && showFxTableBtn) {
    showCurve1TableBtn.addEventListener('click', () => {
        showCurve1TableBtn.classList.add('active');
        showCurve2TableBtn.classList.remove('active');
        showBasisTableBtn.classList.remove('active');
        showFxTableBtn.classList.remove('active');

        if (curve1TableWrapper) curve1TableWrapper.style.display = 'block';
        if (curve2TableWrapper) curve2TableWrapper.style.display = 'none';
        if (basisTableWrapper) basisTableWrapper.style.display = 'none';
        if (fxTableWrapper) fxTableWrapper.style.display = 'none';
    });

    showCurve2TableBtn.addEventListener('click', () => {
        showCurve1TableBtn.classList.remove('active');
        showCurve2TableBtn.classList.add('active');
        showBasisTableBtn.classList.remove('active');
        showFxTableBtn.classList.remove('active');

        if (curve1TableWrapper) curve1TableWrapper.style.display = 'none';
        if (curve2TableWrapper) curve2TableWrapper.style.display = 'block';
        if (basisTableWrapper) basisTableWrapper.style.display = 'none';
        if (fxTableWrapper) fxTableWrapper.style.display = 'none';
    });

    showBasisTableBtn.addEventListener('click', () => {
        showCurve1TableBtn.classList.remove('active');
        showCurve2TableBtn.classList.remove('active');
        showBasisTableBtn.classList.add('active');
        showFxTableBtn.classList.remove('active');

        if (curve1TableWrapper) curve1TableWrapper.style.display = 'none';
        if (curve2TableWrapper) curve2TableWrapper.style.display = 'none';
        if (basisTableWrapper) basisTableWrapper.style.display = 'block';
        if (fxTableWrapper) fxTableWrapper.style.display = 'none';
    });

    showFxTableBtn.addEventListener('click', () => {
        showCurve1TableBtn.classList.remove('active');
        showCurve2TableBtn.classList.remove('active');
        showBasisTableBtn.classList.remove('active');
        showFxTableBtn.classList.add('active');

        if (curve1TableWrapper) curve1TableWrapper.style.display = 'none';
        if (curve2TableWrapper) curve2TableWrapper.style.display = 'none';
        if (basisTableWrapper) basisTableWrapper.style.display = 'none';
        if (fxTableWrapper) fxTableWrapper.style.display = 'block';
    });
}

function updatePnlAttribution() {
    if (!calculationResults || !calculationResults.risk_results) return;

    const c1 = leg1Currency ? leg1Currency.value : 'USD';
    const risk = calculationResults.risk_results;
    
    let leg1Pnl = 0.0;
    document.querySelectorAll('#leg1-delta-tbody .pnl-move-input').forEach(input => {
        const move = parseFloat(input.value) || 0.0;
        const delta = parseFloat(input.dataset.delta) || 0.0;
        leg1Pnl += move * delta;
    });

    let leg2Pnl = 0.0;
    document.querySelectorAll('#leg2-delta-tbody .pnl-move-input').forEach(input => {
        const move = parseFloat(input.value) || 0.0;
        const delta = parseFloat(input.dataset.delta) || 0.0;
        leg2Pnl += move * delta;
    });

    let basisPnl = 0.0;
    document.querySelectorAll('#basis-delta-tbody .pnl-move-input').forEach(input => {
        const move = parseFloat(input.value) || 0.0;
        const delta = parseFloat(input.dataset.delta) || 0.0;
        basisPnl += move * delta;
    });

    const fxBumpEl = document.getElementById('pnl-fx-bump');
    const fxMove = fxBumpEl ? (parseFloat(fxBumpEl.value) || 0.0) : 0.0;
    const fxDelta = risk.parallel.fx_delta_1pct; 
    const fxPnl = fxMove * fxDelta;

    const totalPnl = leg1Pnl + leg2Pnl + basisPnl + fxPnl;

    const formatPnlText = (val) => {
        const prefix = val >= 0 ? '+' : '-';
        const absVal = Math.abs(val);
        return `${prefix}${c1} ${absVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const l1c = document.getElementById('pnl-leg1-contrib');
    const l2c = document.getElementById('pnl-leg2-contrib');
    const bc = document.getElementById('pnl-basis-contrib');
    const fxc = document.getElementById('pnl-fx-contrib');
    if (l1c) l1c.textContent = formatPnlText(leg1Pnl);
    if (l2c) l2c.textContent = formatPnlText(leg2Pnl);
    if (bc) bc.textContent = formatPnlText(basisPnl);
    if (fxc) fxc.textContent = formatPnlText(fxPnl);

    const totalEl = document.getElementById('pnl-total-impact');
    if (totalEl) {
        totalEl.textContent = formatPnlText(totalPnl);
        if (totalPnl >= 0) {
            totalEl.style.color = 'var(--success)';
            totalEl.style.textShadow = '0 0 10px rgba(16,185,129,0.25)';
        } else {
            totalEl.style.color = 'var(--danger)';
            totalEl.style.textShadow = '0 0 10px rgba(239,68,68,0.25)';
        }
    }
}

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