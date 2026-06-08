from data.csv_to_py import DataParser
from src.quant.futures_curve_builder import FuturesCurveBuilder
from quant.swap_pricer import SwapPricer
import datetime

"""
main.py
CLI testing sandbox for the quant library.
Used to locally verify curve building, swap pricing, and financial logic 
independently of the web server and frontend UI.
"""

def main():
    print("=== SWAP CALCULATOR RUN ===\n")
    run_curve_builder()

def run_curve_builder(plot_type='zero_rate'):
    print("--- Starting Futures Curve Pipeline ---")

    parser = DataParser(data_path="src/data/real-data.csv", config_path="src/data/config.json")
    parser.load_configuration()
    parser.load_market_data()

    if parser.curve_data.empty or not parser.settings:
        print("Error: Pipeline halted due to missing data or configuration.")
        return

    print("\n--- Initializing Futures Curve Builder ---")
    try:
        market_data_records = parser.curve_data.to_dict(orient='records')

        builder = FuturesCurveBuilder(
            market_data=market_data_records,
            config=parser.settings
        )
        
        discount_factors = builder.build_curve()
        print("Futures curve complete. Discount factors calculated successfully.")

        # --- NEW SWAP PRICING LOGIC ---
        print("\n--- Pricing Swap Portfolio ---")
        pricer = SwapPricer(builder)

        # Example Trade: 10M Notional, 5-Year Maturity, 3.5% Fixed Rate, Payer Swap
        maturity_date = builder.trade_date + datetime.timedelta(days=5*365)
        notional = 10000000
        fixed_rate = 0.035
        freq = 2

        results = pricer.calculate_dv01(notional, fixed_rate, maturity_date, freq, is_payer=True)

        print(f"Base Swap NPV: ${results['base_npv']:,.2f}")
        print(f"Shifted NPV (+1bp): ${results['bumped_npv']:,.2f}")
        print(f"Swap Delta (DV01): ${results['dv01']:,.2f}")
        
        # Plot the curve at the very end
        builder.plot_curve(plot_type=plot_type)
        
        return discount_factors
        
    except Exception as e:
        print(f"Error during futures curve build: {e}")
        return
    
if __name__ == "__main__":
    # This triggers the main() function when you run the script
    main()