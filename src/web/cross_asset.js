// src/web/cross_asset.js
document.getElementById('calculate-btn').addEventListener('click', async () => {
    // 1. Extract values from UI
    const payload = {
        notional: parseFloat(document.getElementById('notional').value),
        fixed_rate: parseFloat(document.getElementById('fixed-rate').value) / 100.0, // Convert % to decimal
        ticker: document.getElementById('ticker').value.trim(),
        initial_price: parseFloat(document.getElementById('initial-price').value),
        tenor_years: parseInt(document.getElementById('tenor').value)
    };

    // Validation safety net
    if (!payload.ticker || isNaN(payload.initial_price)) {
        alert("Please enter a valid ticker and initial asset price.");
        return;
    }

    try {
        // 2. Fire data to your Flask backend route
        const response = await fetch('/api/price-cross-asset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.status === "success") {
            // 3. Update the UI with the calculation results
            document.getElementById('res-live-price').innerText = `$${data.current_price.toFixed(2)}`;
            document.getElementById('res-return').innerText = data.price_return_pct.toFixed(2);
            document.getElementById('res-npv').innerText = `$${data.swap_npv.toLocaleString()}`;
            
            // Show the panel
            document.getElementById('placeholder-message').style.display = 'none';
            document.getElementById('results-panel').style.display = 'block';            
        } else {
            alert(`Calculation Error: ${data.message}`);
        }
    } catch (error) {
        console.error("Network Error:", error);
        alert("Failed to communicate with pricing server.");
    }
});