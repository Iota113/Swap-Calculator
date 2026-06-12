# Swap-Calculator

This is a web app and quant library built using Python (Flask) and plain HTML/JS/CSS. It is a collaborative project for learning financial concepts like bootstrapping interest rate curves and producing functional products.

## What it does

- **Curve Bootstrapping**: Builds OIS and Treasury discount curves from cash, futures (with IMM date parsing), and swap rates.
- **Liquidity Filter**: Automatically filters out overlapping tenors based on the lowest bid/ask spread (most liquid).
- **Swap Portfolio Pricing**: Prices multiple swap positions, shows net NPV and DV01 (PVBP), and maps out scheduled cashflows.
- **Cross-Currency Swaps**: Prices multi-currency swaps using Covered Interest Parity to project FX forward rates and amortize principal exchange.
- **Asset-Linked Swaps**: Supports asset return legs where payments are tied to the performance of an underlying asset (like a stock or commodity) instead of a fixed/floating interest rate.
- **Math Docs**: A docs page and a LaTeX file (`financial-math.tex`) explaining the math formulas.

## Running it locally

1. Install the packages:
   ```bash
   pip install -r requirements.txt
   ```
2. Start the Flask server:
   ```bash
   python src/app.py
   ```
3. Open `http://127.0.0.1:5000` in your browser.

If you just want to run the quant engine in the command line, you can run `python src/main.py` which will calculate swap NPVs and use matplotlib to show the curves.

## Deployment
It is configured to run on Render via `render.yaml` and `Procfile` using Gunicorn.
