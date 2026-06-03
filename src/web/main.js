// App State
let marketQuotes = [];
let calculationResults = null;
let currentChartType = 'zero_rate'; // 'zero_rate' or 'discount_factor'
let yieldChart = null;

// DOM Elements
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const marketTableBody = document.getElementById('market-table-body');
const addRowBtn = document.getElementById('add-row');
const clearTableBtn = document.getElementById('clear-table');
const calculateBtn = document.getElementById('calculate-btn');
const resultsContainer = document.getElementById('results-container');
const outputTableBody = document.getElementById('output-table-body');
const alertContainer = document.getElementById('alert-container');
const themeToggleBtn = document.getElementById('theme-toggle');
const downloadTemplateBtn = document.getElementById('download-template');
const loadSampleBtn = document.getElementById('load-sample');
const showZeroRateBtn = document.getElementById('show-zero-rate');
const showDfBtn = document.getElementById('show-df');
const exportResultsBtn = document.getElementById('export-results');

// Initial setup
document.addEventListener('DOMContentLoaded', () => {
    // Theme initialization
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
    
    // Load default sample data to make the page look complete at first sight
    loadSampleData();
});

// Theme toggle logic
themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
    
    // Redraw chart if exists to match theme grid/label colors
    if (calculationResults) {
        renderCharts();
    }
});

function updateThemeIcon(theme) {
    const icon = themeToggleBtn.querySelector('i');
    if (theme === 'dark') {
        icon.className = 'fa-solid fa-sun';
    } else {
        icon.className = 'fa-solid fa-moon';
    }
}

// Sample Data Loading
const sampleData = [
    { Instrument: 'Cash', Tenor: 'O/N', QuoteType: 'RATE', Quote: 3.550 },
    { Instrument: 'Cash', Tenor: '1M', QuoteType: 'RATE', Quote: 3.608 },
    { Instrument: 'Cash', Tenor: '3M', QuoteType: 'RATE', Quote: 3.649 },
    { Instrument: 'Future', Tenor: 'SR3M6', QuoteType: 'PRICE', Quote: 96.330 },
    { Instrument: 'Future', Tenor: 'SR3U6', QuoteType: 'PRICE', Quote: 96.250 },
    { Instrument: 'Future', Tenor: 'SR3Z6', QuoteType: 'PRICE', Quote: 96.155 },
    { Instrument: 'Future', Tenor: 'SR3H7', QuoteType: 'PRICE', Quote: 96.080 },
    { Instrument: 'Future', Tenor: 'SR3M7', QuoteType: 'PRICE', Quote: 96.065 },
    { Instrument: 'Future', Tenor: 'SR3U7', QuoteType: 'PRICE', Quote: 96.095 },
    { Instrument: 'Future', Tenor: 'SR3Z7', QuoteType: 'PRICE', Quote: 96.140 },
    { Instrument: 'Future', Tenor: 'SR3H8', QuoteType: 'PRICE', Quote: 96.170 },
    { Instrument: 'Future', Tenor: 'SR3M8', QuoteType: 'PRICE', Quote: 96.180 },
    { Instrument: 'Swap', Tenor: '1Y', QuoteType: 'RATE', Quote: 3.849 },
    { Instrument: 'Swap', Tenor: '2Y', QuoteType: 'RATE', Quote: 3.899 },
    { Instrument: 'Swap', Tenor: '3Y', QuoteType: 'RATE', Quote: 3.889 },
    { Instrument: 'Swap', Tenor: '5Y', QuoteType: 'RATE', Quote: 3.906 },
    { Instrument: 'Swap', Tenor: '7Y', QuoteType: 'RATE', Quote: 3.975 },
    { Instrument: 'Swap', Tenor: '10Y', QuoteType: 'RATE', Quote: 4.089 },
    { Instrument: 'Swap', Tenor: '15Y', QuoteType: 'RATE', Quote: 4.264 },
    { Instrument: 'Swap', Tenor: '30Y', QuoteType: 'RATE', Quote: 4.308 }
];

function loadSampleData() {
    marketQuotes = JSON.parse(JSON.stringify(sampleData));
    renderTable();
    showAlert('Sample market data loaded successfully!', 'success');
}

loadSampleBtn.addEventListener('click', loadSampleData);

// CSV Template Download
downloadTemplateBtn.addEventListener('click', () => {
    const csvContent = "Instrument,Tenor,QuoteType,Quote\n" +
        "Cash,O/N,RATE,3.55\n" +
        "Cash,1M,RATE,3.608\n" +
        "Future,SR3M6,PRICE,96.33\n" +
        "Swap,1Y,RATE,3.849\n" +
        "Swap,5Y,RATE,3.906";
        
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "yieldcurve_template.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// Render Manual Quotes Table
function renderTable() {
    marketTableBody.innerHTML = '';
    
    if (marketQuotes.length === 0) {
        marketTableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 30px;">
                    No market quotes loaded. Drag & drop a file or click 'Add Quote' to get started.
                </td>
            </tr>
        `;
        return;
    }
    
    marketQuotes.forEach((quote, idx) => {
        const tr = document.createElement('tr');
        
        tr.innerHTML = `
            <td>
                <select class="row-instrument" data-index="${idx}">
                    <option value="Cash" ${quote.Instrument === 'Cash' ? 'selected' : ''}>Cash</option>
                    <option value="Future" ${quote.Instrument === 'Future' ? 'selected' : ''}>Future</option>
                    <option value="Swap" ${quote.Instrument === 'Swap' ? 'selected' : ''}>Swap</option>
                </select>
            </td>
            <td>
                <input type="text" class="row-tenor" value="${quote.Tenor}" data-index="${idx}" placeholder="e.g. 3M">
            </td>
            <td>
                <select class="row-quotetype" data-index="${idx}">
                    <option value="RATE" ${quote.QuoteType === 'RATE' ? 'selected' : ''}>RATE (yield %)</option>
                    <option value="PRICE" ${quote.QuoteType === 'PRICE' ? 'selected' : ''}>PRICE (futures)</option>
                </select>
            </td>
            <td>
                <input type="number" class="row-quote" value="${quote.Quote}" step="0.001" data-index="${idx}">
            </td>
            <td style="text-align: center;">
                <button class="btn btn-danger btn-sm del-port-row" data-index="${idx}" title="Delete Quote">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </td>
        `;
        
        marketTableBody.appendChild(tr);
    });
    
    // Add Row Event Listeners for inputs
    document.querySelectorAll('.row-instrument').forEach(el => {
        el.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.index);
            marketQuotes[idx].Instrument = e.target.value;
            // Autofill QuoteType
            const typeSelect = document.querySelector(`.row-quotetype[data-index="${idx}"]`);
            if (e.target.value === 'Future') {
                marketQuotes[idx].QuoteType = 'PRICE';
                typeSelect.value = 'PRICE';
            } else {
                marketQuotes[idx].QuoteType = 'RATE';
                typeSelect.value = 'RATE';
            }
        });
    });
    
    document.querySelectorAll('.row-tenor').forEach(el => {
        el.addEventListener('input', (e) => {
            const idx = parseInt(e.target.dataset.index);
            marketQuotes[idx].Tenor = e.target.value.trim().toUpperCase();
        });
    });
    
    document.querySelectorAll('.row-quotetype').forEach(el => {
        el.addEventListener('change', (e) => {
            const idx = parseInt(e.target.dataset.index);
            marketQuotes[idx].QuoteType = e.target.value;
        });
    });
    
    document.querySelectorAll('.row-quote').forEach(el => {
        el.addEventListener('input', (e) => {
            const idx = parseInt(e.target.dataset.index);
            marketQuotes[idx].Quote = parseFloat(e.target.value) || 0;
        });
    });
    
    document.querySelectorAll('.del-port-row').forEach(el => {
        el.addEventListener('click', (e) => {
            // Find parent button if icon was clicked
            const btn = e.target.closest('.del-port-row');
            const idx = parseInt(btn.dataset.index);
            marketQuotes.splice(idx, 1);
            renderTable();
        });
    });
}

// Table Editing Actions
addRowBtn.addEventListener('click', () => {
    // Default new row matching the last item type, or Cash
    const defaultInst = marketQuotes.length > 0 ? marketQuotes[marketQuotes.length - 1].Instrument : 'Cash';
    const defaultType = defaultInst === 'Future' ? 'PRICE' : 'RATE';
    
    marketQuotes.push({
        Instrument: defaultInst,
        Tenor: '',
        QuoteType: defaultType,
        Quote: 0.0
    });
    
    renderTable();
    
    // Scroll to the bottom of table
    const wrapper = document.querySelector('.table-wrapper');
    wrapper.scrollTop = wrapper.scrollHeight;
});

clearTableBtn.addEventListener('click', () => {
    marketQuotes = [];
    renderTable();
    showAlert('Market quotes cleared.', 'info');
});

// Drag and drop setup
dropzone.addEventListener('click', () => fileInput.click());

dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
});

['dragleave', 'dragend'].forEach(eventName => {
    dropzone.addEventListener(eventName, () => {
        dropzone.classList.remove('dragover');
    });
});

dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    
    if (e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

function handleFile(file) {
    const reader = new FileReader();
    const ext = file.name.split('.').pop().toLowerCase();
    
    if (ext === 'csv') {
        reader.onload = (e) => {
            try {
                const parsed = parseCSV(e.target.result);
                if (parsed.length > 0) {
                    marketQuotes = parsed;
                    renderTable();
                    showAlert(`Successfully imported ${parsed.length} quotes from ${file.name}!`, 'success');
                } else {
                    showAlert('CSV file was empty or had no valid rows.', 'danger');
                }
            } catch (err) {
                showAlert(`Error parsing CSV file: ${err.message}`, 'danger');
            }
        };
        reader.readAsText(file);
    } else if (ext === 'xlsx' || ext === 'xls') {
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(sheet);
                
                const parsed = json.map((row, idx) => {
                    const findVal = (name) => {
                        const key = Object.keys(row).find(k => k.toLowerCase() === name.toLowerCase());
                        return key ? row[key] : '';
                    };
                    
                    const inst = String(findVal('instrument')).trim();
                    const tenor = String(findVal('tenor')).trim();
                    const quoteType = String(findVal('quotetype')).trim().toUpperCase();
                    const quote = parseFloat(findVal('quote'));
                    
                    if (!inst || !tenor || isNaN(quote)) {
                        throw new Error(`Row ${idx + 2} is missing critical fields (Instrument, Tenor, or Quote)`);
                    }
                    
                    return {
                        Instrument: inst.charAt(0).toUpperCase() + inst.slice(1).toLowerCase(),
                        Tenor: tenor.toUpperCase(),
                        QuoteType: quoteType || (inst.toLowerCase() === 'future' ? 'PRICE' : 'RATE'),
                        Quote: quote
                    };
                });
                
                if (parsed.length > 0) {
                    marketQuotes = parsed;
                    renderTable();
                    showAlert(`Successfully imported ${parsed.length} quotes from ${file.name}!`, 'success');
                } else {
                    showAlert('Excel sheet was empty.', 'danger');
                }
            } catch (err) {
                showAlert(`Error parsing Excel file: ${err.message}`, 'danger');
            }
        };
        reader.readAsArrayBuffer(file);
    } else {
        showAlert('Unsupported file format. Please upload a .csv or .xlsx file.', 'danger');
    }
}

// Custom simple CSV parser
function parseCSV(text) {
    const lines = text.split(/\r?\n/);
    if (lines.length === 0) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
    
    const instIdx = headers.findIndex(h => h.toLowerCase() === 'instrument');
    const tenorIdx = headers.findIndex(h => h.toLowerCase() === 'tenor');
    const typeIdx = headers.findIndex(h => h.toLowerCase() === 'quotetype');
    const quoteIdx = headers.findIndex(h => h.toLowerCase() === 'quote');
    
    if (instIdx === -1 || tenorIdx === -1 || typeIdx === -1 || quoteIdx === -1) {
        throw new Error('CSV headers must include: Instrument, Tenor, QuoteType, Quote');
    }
    
    const records = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const cols = line.split(',').map(c => c.trim().replace(/^["']|["']$/g, ''));
        if (cols.length <= Math.max(instIdx, tenorIdx, typeIdx, quoteIdx)) continue;
        
        const instRaw = cols[instIdx];
        const inst = instRaw.charAt(0).toUpperCase() + instRaw.slice(1).toLowerCase();
        
        records.push({
            Instrument: inst,
            Tenor: cols[tenorIdx].toUpperCase(),
            QuoteType: cols[typeIdx].toUpperCase(),
            Quote: parseFloat(cols[quoteIdx]) || 0.0
        });
    }
    return records;
}

// Alert Handler
function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    
    let iconClass = 'fa-circle-info';
    if (type === 'danger') iconClass = 'fa-circle-xmark';
    if (type === 'success') iconClass = 'fa-circle-check';
    if (type === 'warning') iconClass = 'fa-triangle-exclamation';
    
    alertDiv.innerHTML = `
        <i class="fa-solid ${iconClass}"></i>
        <span>${message}</span>
    `;
    
    alertContainer.innerHTML = '';
    alertContainer.appendChild(alertDiv);
    
    // Auto remove alerts after 8 seconds (except error logs)
    if (type !== 'danger') {
        setTimeout(() => {
            alertDiv.style.opacity = '0';
            alertDiv.style.transform = 'translateY(-10px)';
            alertDiv.style.transition = 'all 0.5s ease';
            setTimeout(() => alertDiv.remove(), 500);
        }, 8000);
    }
}

// API Calculation Trigger
calculateBtn.addEventListener('click', async () => {
    // Basic frontend checks
    if (marketQuotes.length === 0) {
        showAlert('Cannot build curve: market quotes table is empty.', 'danger');
        return;
    }
    
    // Validate rows
    for (let i = 0; i < marketQuotes.length; i++) {
        const row = marketQuotes[i];
        if (!row.Tenor) {
            showAlert(`Row ${i + 1}: Tenor is required (e.g. O/N, 3M, 10Y).`, 'danger');
            return;
        }
        if (isNaN(row.Quote) || row.Quote === null) {
            showAlert(`Row ${i + 1} (${row.Tenor}): Quote must be a valid number.`, 'danger');
            return;
        }
    }
    
    // Extract configs
    const tradeDate = document.getElementById('trade-date').value.trim();
    const dayCount = document.getElementById('day-count').value;
    const paymentFreq = parseInt(document.getElementById('payment-freq').value);
    const interpolation = document.getElementById('interpolation').value;
    const cutoffYears = parseFloat(document.getElementById('cutoff-years').value);
    
    // Validation for date format DD-MM-YYYY
    const dateRegex = /^\d{2}-\d{2}-\d{4}$/;
    if (!dateRegex.test(tradeDate)) {
        showAlert('Trade Date must match format DD-MM-YYYY (e.g., 28-05-2026).', 'danger');
        return;
    }
    
    // Show spinner
    calculateBtn.disabled = true;
    calculateBtn.innerHTML = `<span class="spinner"></span> Computing Curve...`;
    
    try {
        const startTime = performance.now();
        
        const response = await fetch('/api/calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                config: {
                    trade_date: tradeDate,
                    day_count_convention: dayCount,
                    payment_frequency: paymentFreq,
                    interpolation_method: interpolation,
                    futures_cutoff_years: cutoffYears
                },
                market_data: marketQuotes,
                portfolio: gatherPortfolioData() // Array of swaps from the portfolio table
            })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            showAlert(data.error || 'Unknown curve calculation error.', 'danger');
            resultsContainer.style.display = 'none';
        } else {
            calculationResults = data;
            const elapsed = Math.round(performance.now() - startTime);
            showAlert(`Yield curve calculated successfully in ${elapsed}ms! Method used: ${data.curves.method}`, 'success');
            
            // Show container and render UI components
            resultsContainer.style.display = 'grid';
            renderOutputTable();
            renderCharts();
            
            // Portfolio (interest rate swap) valuation results
            if (data.portfolio_results) {
                const resultsDiv = document.getElementById('portfolio-results');
                const npvSpan = document.getElementById('out-npv');
                const pvbpSpan = document.getElementById('out-pvbp');
                
                // Format numbers with commas for readability
                npvSpan.textContent = "$" + data.portfolio_results.base_npv.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                pvbpSpan.textContent = "$" + data.portfolio_results.pvbp.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                
                resultsDiv.style.display = 'flex'; // Make the div visible
            }
            
            // Portfolio cashflow projection chart
            drawCashflowChart(data.cashflows);
            
            // Scroll to results
            resultsContainer.scrollIntoView({ behavior: 'smooth' });
        }
    } catch (err) {
        showAlert(`Network error: ${err.message}. Make sure the Flask server is running.`, 'danger');
    } finally {
        calculateBtn.disabled = false;
        calculateBtn.innerHTML = `<i class="fa-solid fa-bolt"></i> Generate Curves`;
    }
});

// Render Output Table
function renderOutputTable() {
    outputTableBody.innerHTML = '';
    
    if (!calculationResults || !calculationResults.knots) return;
    
    calculationResults.knots.forEach(knot => {
        const tr = document.createElement('tr');
        
        let statusBadge = '';
        if (knot.error) {
            statusBadge = `<span class="status-badge error">Error</span>`;
        } else if (knot.skipped) {
            statusBadge = `<span class="status-badge skipped">Skipped</span>`;
        } else {
            statusBadge = `<span class="status-badge active">Active</span>`;
        }
        
        const tVal = knot.t !== undefined ? knot.t : '-';
        const dfVal = knot.df !== undefined ? knot.df : '-';
        const zeroVal = knot.zero_rate !== undefined ? knot.zero_rate.toFixed(4) + '%' : '-';
        const matVal = knot.maturity_date || '-';
        
        tr.innerHTML = `
            <td><strong>${knot.instrument}</strong></td>
            <td>${knot.tenor}</td>
            <td>${knot.quote.toFixed(3)}</td>
            <td>${matVal}</td>
            <td>${tVal}</td>
            <td>${dfVal}</td>
            <td>${zeroVal}</td>
            <td>${statusBadge}</td>
        `;
        
        outputTableBody.appendChild(tr);
    });
}

// Chart Toggle Tabs
showZeroRateBtn.addEventListener('click', () => {
    if (currentChartType === 'zero_rate') return;
    currentChartType = 'zero_rate';
    showZeroRateBtn.classList.add('active');
    showDfBtn.classList.remove('active');
    renderCharts();
});

showDfBtn.addEventListener('click', () => {
    if (currentChartType === 'discount_factor') return;
    currentChartType = 'discount_factor';
    showDfBtn.classList.add('active');
    showZeroRateBtn.classList.remove('active');
    renderCharts();
});

// ==========================================
// DYNAMIC PORTFOLIO TABLE LOGIC
// ==========================================
const portfolioTableBody = document.getElementById('portfolio-table-body');
const addPortfolioRowBtn = document.getElementById('add-portfolio-row');

function formatWithCommas(value) {
    let num = value.replace(/[^0-9.]/g, ''); // Strip everything except numbers and periods
    if (!num) return '';
    let parts = num.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
}

function addPortfolioRow(notional = 10000000, rate = "3.50", tenor = 5, freq = 2, position = 'payer') {
    if (!portfolioTableBody) return; 
    
    const formattedNotional = formatWithCommas(notional.toString());
    const tr = document.createElement('tr');
    
    // Changed inputs to type="text" to allow commas and words like "SOFR"
    tr.innerHTML = `
        <td><input type="text" class="port-notional" value="${formattedNotional}" placeholder="10,000,000"></td>
        <td><input type="text" class="port-rate" value="${rate}" placeholder="3.5 or SOFR + 0.5"></td>
        <td><input type="number" class="port-tenor" value="${tenor}" step="1"></td>
        <td>
            <select class="port-frequency">
                <option value="1" ${freq === 1 ? 'selected' : ''}>1x</option>
                <option value="2" ${freq === 2 ? 'selected' : ''}>2x</option>
                <option value="4" ${freq === 4 ? 'selected' : ''}>4x</option>
                <option value="12" ${freq === 12 ? 'selected' : ''}>12x</option>
            </select>
        </td>
        <td>
            <select class="port-position">
                <option value="payer" ${position === 'payer' ? 'selected' : ''}>Payer</option>
                <option value="receiver" ${position === 'receiver' ? 'selected' : ''}>Receiver</option>
            </select>
        </td>
        <td style="text-align: center;">
            <button class="btn btn-danger btn-sm del-port-row" title="Delete Swap"><i class="fa-solid fa-trash-can"></i></button>
        </td>
    `;
    
    // Live comma formatting as the user types
    const notionalInput = tr.querySelector('.port-notional');
    notionalInput.addEventListener('input', (e) => {
        e.target.value = formatWithCommas(e.target.value);
    });

    tr.querySelector('.del-port-row').addEventListener('click', () => tr.remove());
    portfolioTableBody.appendChild(tr);
}

const clearPortfolioBtn = document.getElementById('clear-portfolio');
if (clearPortfolioBtn) {
    clearPortfolioBtn.addEventListener('click', () => {
        portfolioTableBody.innerHTML = '';
        addPortfolioRow(0, "", 0, 2, 'payer'); // Leave one empty row
    });
}

// Seed one default row if the table exists
if (portfolioTableBody) {
    addPortfolioRow();
}

// Add an empty row on '+' button click
if (addPortfolioRowBtn) {
    addPortfolioRowBtn.addEventListener('click', () => addPortfolioRow(0, 0, 0, 2, 'payer'));
}

// Collect all swaps from the portfolio table into an array for the backend
function gatherPortfolioData() {
    if (!portfolioTableBody) return [];
    try {
        const rows = portfolioTableBody.querySelectorAll('tr');
        const portfolio = [];
        rows.forEach(row => {
            const notionalInput = row.querySelector('.port-notional');
            const rateInput = row.querySelector('.port-rate');
            const tenorInput = row.querySelector('.port-tenor');
            const freqSelect = row.querySelector('.port-frequency');
            const positionSelect = row.querySelector('.port-position');

            if (notionalInput && rateInput && tenorInput && positionSelect) {
                // Strip commas before sending to Python
                const cleanNotional = parseFloat(notionalInput.value.replace(/,/g, '')) || 0;
                
                // NLP Rate Parsing: Detect "SOFR" or "FLOAT"
                const rateRaw = rateInput.value.toUpperCase();
                let rateType = 'fixed';
                let parsedRate = 0;

                if (rateRaw.includes('SOFR') || rateRaw.includes('FLOAT')) {
                    rateType = 'floating';
                    // Extract the spread number (e.g., "SOFR + 0.5" -> 0.5)
                    const match = rateRaw.match(/[-+]?[0-9]*\.?[0-9]+/);
                    parsedRate = match ? parseFloat(match[0]) : 0;
                } else {
                    parsedRate = parseFloat(rateRaw) || 0;
                }

                portfolio.push({
                    notional: cleanNotional,
                    rate_type: rateType,
                    fixed_rate: parsedRate, // This acts as the "Spread" if rate_type is floating
                    tenor_years: parseInt(tenorInput.value) || 0,
                    frequency: parseInt(freqSelect.value) || 2,
                    position: positionSelect.value
                });
            }
        });
        return portfolio;
    } catch (error) {
        console.error("Error gathering portfolio data:", error);
        return [];
    }
}

// Draw Chart via Chart.js
function renderCharts() {
    if (!calculationResults || !calculationResults.curves) return;
    
    const ctx = document.getElementById('yield-chart').getContext('2d');
    
    // Destroy existing chart to prevent canvas redraw bug
    if (yieldChart) {
        yieldChart.destroy();
    }
    
    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    const isDark = theme === 'dark';
    
    // Theme styling variables
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
    const textColor = isDark ? '#94a3b8' : '#475569';
    const tooltipBg = isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)';
    const tooltipBorder = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
    const tooltipText = isDark ? '#f8fafc' : '#0f172a';
    
    const curves = calculationResults.curves;
    const knots = calculationResults.knots.filter(k => !k.error && !k.skipped && k.t > 0);
    
    let chartTitle = '';
    let curveLabel = '';
    let yLabel = '';
    let smoothData = [];
    let knotData = [];
    let lineColor = '#3b82f6';
    let knotColor = '#10b981';
    
    if (currentChartType === 'zero_rate') {
        chartTitle = `Zero Yield Curve (${curves.method} Interpolated)`;
        curveLabel = 'Smoothed Zero Rate';
        yLabel = 'Continuous Zero Rate (%)';
        smoothData = curves.times.map((t, idx) => ({ x: t, y: curves.zero_rates[idx] }));
        knotData = knots.map(k => ({ x: k.t, y: k.zero_rate, label: k.tenor }));
        lineColor = '#3b82f6'; // Neon Blue
        knotColor = '#06b6d4'; // Cyan
    } else {
        chartTitle = `Discount Factor Curve (${curves.method} Interpolated)`;
        curveLabel = 'Smoothed Discount Factor';
        yLabel = 'Discount Factor D(0, T)';
        smoothData = curves.times.map((t, idx) => ({ x: t, y: curves.discount_factors[idx] }));
        knotData = knots.map(k => ({ x: k.t, y: k.df, label: k.tenor }));
        lineColor = '#10b981'; // Emerald Green
        knotColor = '#f59e0b'; // Amber Gold
    }
    
    // Add t=0 endpoint for Discount Factor (which always equals 1.0)
    if (currentChartType === 'discount_factor') {
        smoothData.unshift({ x: 0, y: 1.0 });
        knotData.unshift({ x: 0, y: 1.0, label: 'Origin (0)' });
    }
    
    yieldChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: curveLabel,
                    data: smoothData,
                    showLine: true,
                    borderColor: lineColor,
                    borderWidth: 2.5,
                    pointRadius: 0, // Hide points for the smooth line
                    pointHitRadius: 0,
                    fill: false,
                    tension: 0.1
                },
                {
                    label: 'Bootstrapped Knots',
                    data: knotData,
                    showLine: false,
                    pointBackgroundColor: knotColor,
                    pointBorderColor: isDark ? '#070913' : '#ffffff',
                    pointBorderWidth: 1.5,
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    z: 10
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // size follows the bounded .chart-canvas-holder
            resizeDelay: 200,           // throttle resize handling to avoid layout jitter
            interaction: {
                mode: 'nearest',
                intersect: false
            },
            plugins: {
                title: {
                    display: true,
                    text: chartTitle,
                    color: isDark ? '#f8fafc' : '#0f172a',
                    font: {
                        family: 'Outfit',
                        size: 16,
                        weight: '600'
                    },
                    padding: { bottom: 15 }
                },
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: textColor,
                        font: { family: 'Inter', size: 12 }
                    }
                },
                tooltip: {
                    enabled: true,
                    backgroundColor: tooltipBg,
                    borderColor: tooltipBorder,
                    borderWidth: 1,
                    titleColor: tooltipText,
                    bodyColor: tooltipText,
                    titleFont: { family: 'Outfit', weight: 'bold' },
                    bodyFont: { family: 'Inter' },
                    callbacks: {
                        label: function (context) {
                            const point = context.raw;
                            const t = point.x.toFixed(4);
                            const val = point.y.toFixed(5);
                            
                            // Check if this point is a knot
                            if (context.datasetIndex === 1) {
                                return `Knot ${point.label || ''} | Tenor t: ${t}y | Value: ${val}${currentChartType === 'zero_rate' ? '%' : ''}`;
                            } else {
                                return `Tenor t: ${t}y | Value: ${val}${currentChartType === 'zero_rate' ? '%' : ''}`;
                            }
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'linear',
                    title: {
                        display: true,
                        text: 'Tenor Time (Years)',
                        color: textColor,
                        font: { family: 'Outfit', size: 12, weight: '600' }
                    },
                    grid: { color: gridColor },
                    ticks: {
                        color: textColor,
                        font: { family: 'Inter' }
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: yLabel,
                        color: textColor,
                        font: { family: 'Outfit', size: 12, weight: '600' }
                    },
                    grid: { color: gridColor },
                    ticks: {
                        color: textColor,
                        font: { family: 'Inter' }
                    }
                }
            }
        }
    });
}

// Export Knots Output as CSV
exportResultsBtn.addEventListener('click', () => {
    if (!calculationResults || !calculationResults.knots) return;
    
    let csvContent = "Instrument,Tenor,Quote,MaturityDate,TimeInYears,DiscountFactor,ZeroRate\n";
    
    calculationResults.knots.forEach(k => {
        if (k.error) return; // skip errors
        const dfVal = k.df !== undefined ? k.df : '';
        const zeroVal = k.zero_rate !== undefined ? k.zero_rate : '';
        const matVal = k.maturity_date || '';
        csvContent += `${k.instrument},${k.tenor},${k.quote},${matVal},${k.t},${dfVal},${zeroVal}\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `yieldcurve_results_${document.getElementById('trade-date').value}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});
// ==========================================
// PORTFOLIO CASHFLOW PROJECTION CHART
// ==========================================
let cashflowChart = null;

function drawCashflowChart(cashflowData) {
    const canvas = document.getElementById('cashflow-chart');
    if (!canvas) return;

    // Nothing to show: clear any prior chart and bail out
    if (!cashflowData || cashflowData.length === 0) {
        if (cashflowChart) {
            cashflowChart.destroy();
            cashflowChart = null;
        }
        return;
    }

    const ctx = canvas.getContext('2d');
    if (cashflowChart) cashflowChart.destroy();

    const labels = cashflowData.map(d => d.date);
    const netFlows = cashflowData.map(d => d.net_cashflow);
    const cumulativeFlows = cashflowData.map(d => d.cumulative);

    // --- Dynamic Symmetric Axis Calculation ---
    // Find the absolute peak value for Cumulative to create equal bounds around 0
    const maxCumulative = Math.max(...cumulativeFlows.map(Math.abs), 0);
    const cumulativeBound = maxCumulative === 0 ? 100 : maxCumulative * 1.15; // 15% padding

    // Find the absolute peak value for Net Flows to create equal bounds around 0
    const maxNet = Math.max(...netFlows.map(Math.abs), 0);
    const netBound = maxNet === 0 ? 100 : maxNet * 1.15; // 15% padding
    // ------------------------------------------

    cashflowChart = new Chart(ctx, {
        type: 'bar', // Base type
        data: {
            labels: labels,
            datasets: [
                {
                    type: 'line',
                    label: 'Cumulative Equity',
                    data: cumulativeFlows,
                    borderColor: '#3b82f6', // Primary blue
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 3,
                    tension: 0.3,
                    fill: true,
                    yAxisID: 'y'
                },
                {
                    type: 'bar',
                    label: 'Net Period Cashflow',
                    data: netFlows,
                    // Dynamic map inside render loop works, but since it's hardcoded on init, we pass the array
                    backgroundColor: netFlows.map(val => val >= 0 ? '#10b981' : '#ef4444'), // Green if positive, Red if negative
                    barThickness: 4, // Keeps the bars thin like a lollipop chart
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            resizeDelay: 200,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#94a3b8' }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: { display: true, text: 'Cumulative ($)', color: '#94a3b8' },
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#94a3b8' },
                    // Force symmetric bounds around 0
                    min: -cumulativeBound,
                    max: cumulativeBound
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: { display: true, text: 'Net Cashflow ($)', color: '#94a3b8' },
                    grid: { 
                        drawOnChartArea: true,
                        // Highlighting the zero baseline explicitly
                        color: (context) => context.tick.value === 0 ? 'rgba(255, 255, 255, 0.25)' : 'transparent',
                        lineWidth: (context) => context.tick.value === 0 ? 2 : 1
                    }, 
                    ticks: { color: '#94a3b8' },
                    // Force symmetric bounds around 0
                    min: -netBound,
                    max: netBound
                }
            }
        }
    });
}