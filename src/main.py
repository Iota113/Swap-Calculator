from data.csv_to_py import DataParser
from futures_curve_builder import FuturesCurveBuilder

def main():
    print("=== SWAP CALCULATOR QUICK-TEST SANDBOX ===\n")

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
        
        builder.plot_curve(plot_type=plot_type)
        
        print("Futures curve complete. Discount factors calculated successfully.")
        return discount_factors
        
    except Exception as e:
        print(f"Error during futures curve build: {e}")
        return
    
if __name__ == "__main__":
    run_curve_builder()