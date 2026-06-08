// src/web/cross_asset.js
document.getElementById('calculate-btn').addEventListener('click', async () => {
    const notional  = parseFloat(document.getElementById('notional').value);
    const fixedRate = parseFloat(document.getElementById('fixed-rate').value);
    const ticker    = document.getElementById('ticker').value.trim().toUpperCase();
    const initialPrice = parseFloat(document.getElementById('initial-price').value);
    const tenorYears   = parseInt(document.getElementById('tenor').value);

    if (!ticker || isNaN(initialPrice) || isNaN(notional) || isNaN(tenorYears)) {
        alert("Please fill in all fields with valid values.");
        return;
    }

    const today = new Date();
    const tradeDate = `${String(today.getDate()).padStart(2,'0')}-${String(today.getMonth()+1).padStart(2,'0')}-${today.getFullYear()}`;

    const payload = {
        config: {
            curve_type: "OIS",
            trade_date: tradeDate,
            day_count_convention: "ACT/365",
            payment_frequency: 2,
            interpolation_method: "Cubic Spline",
            futures_cutoff_years: 2.0
        },
        market_data: [
            { Instrument: "Cash", Tenor: "O/N", QuoteType: "RATE", Quote: 4.33 },
            { Instrument: "Cash", Tenor: "1M",  QuoteType: "RATE", Quote: 4.32 },
            { Instrument: "Cash", Tenor: "3M",  QuoteType: "RATE", Quote: 4.31 },
            { Instrument: "Cash", Tenor: "6M",  QuoteType: "RATE", Quote: 4.28 },
            { Instrument: "Cash", Tenor: "1Y",  QuoteType: "RATE", Quote: 4.10 },
            { Instrument: "Swap", Tenor: "2Y",  QuoteType: "RATE", Quote: 3.95 },
            { Instrument: "Swap", Tenor: "5Y",  QuoteType: "RATE", Quote: 3.85 },
            { Instrument: "Swap", Tenor: "10Y", QuoteType: "RATE", Quote: 3.90 },
        ],
        portfolio: [{
            notional:      notional,
            fixed_rate:    fixedRate,
            tenor_years:   tenorYears,
            position:      "payer",
            ticker:        ticker,
            initial_price: initialPrice
        }]
    };

    const btn = document.getElementById('calculate-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Fetching live data...';

    try {
        const response = await fetch('/api/calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.success && data.portfolio_results) {
            const pr = data.portfolio_results;

            document.getElementById('res-npv').innerText  = `$${pr.base_npv.toLocaleString()}`;
            document.getElementById('res-pvbp').innerText = `$${pr.pvbp.toLocaleString()}`;
            document.getElementById('res-positions').innerText = pr.positions_priced;

            document.getElementById('placeholder-message').style.display = 'none';
            document.getElementById('results-panel').style.display = 'block';
        } else {
            alert(`Error: ${data.error || 'Unknown error from server.'}`);
        }
    } catch (error) {
        console.error("Network Error:", error);
        alert("Failed to communicate with pricing server.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-play"></i> Calculate Cross-Asset NPV';
    }
});