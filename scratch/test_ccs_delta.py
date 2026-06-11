import os
import sys
import datetime

# Ensure the src directory is in the import path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src')))

from data.csv_to_py import DataParser
from quant.futures_curve_builder import FuturesCurveBuilder
from quant.basis_curve_builder import CrossCurrencyBasisCurveBuilder
from quant.currency_swap_pricer import CurrencySwapPricer
from quant.risk_engine import RiskEngine

def main():
    print("=== VERIFYING CCS RISK WITH THE FIXED LIBRARY ===")
    
    # Load market data
    usd_parser = DataParser(data_path="src/data/usd_ois_fallback.csv", config_path="src/data/config.json")
    usd_parser.load_configuration()
    usd_parser.load_market_data()
    usd_records = usd_parser.curve_data.to_dict(orient='records')
    
    eur_parser = DataParser(data_path="src/data/eur_fallback.csv", config_path="src/data/config.json")
    eur_parser.load_configuration()
    eur_parser.load_market_data()
    eur_records = eur_parser.curve_data.to_dict(orient='records')
    
    basis_parser = DataParser(data_path="src/data/basis_fallback.csv", config_path="src/data/config.json")
    basis_parser.load_configuration()
    basis_parser.load_market_data()
    basis_records = basis_parser.curve_data.to_dict(orient='records')
    
    trade_date = datetime.date(2026, 5, 28)
    maturity_date = trade_date + datetime.timedelta(days=5*365)
    
    config1 = {
        'trade_date': '28-05-2026',
        'day_count_convention': 'ACT/365',
        'payment_frequency': 2,
        'interpolation_method': 'Cubic Spline',
        'futures_cutoff_years': 2.0
    }
    
    config2 = {
        'trade_date': '28-05-2026',
        'day_count_convention': 'ACT/365',
        'payment_frequency': 2,
        'interpolation_method': 'Cubic Spline',
        'futures_cutoff_years': 2.0
    }
    
    config_basis = {
        'trade_date': '28-05-2026',
        'day_count_convention': 'ACT/365',
        'payment_frequency': 2,
        'interpolation_method': 'Cubic Spline',
    }
    
    # Build base curves
    builder1 = FuturesCurveBuilder(market_data=usd_records, config=config1)
    builder1.build_curve()
    
    builder2 = FuturesCurveBuilder(market_data=eur_records, config=config2)
    builder2.build_curve()
    
    basis_builder = CrossCurrencyBasisCurveBuilder(market_data=basis_records, curve2=builder2, config=config_basis)
    basis_builder.build_curve()
    
    # ------------------ TEST CASE A: FIXED LEG 2 ------------------
    print("\n--- Test Case A: Leg 1 USD Floating, Leg 2 EUR Fixed (3.0%) ---")
    leg1_cfg = {
        'notional': 10000000.0,
        'rate_type': 'float',
        'rate_or_spread': 0.0,
        'frequency': 2,
        'day_count': 'ACT/365',
        'is_payer': True
    }
    leg2_cfg = {
        'notional': 9000000.0, # in EUR
        'rate_type': 'fixed',
        'rate_or_spread': 3.0, # 3% fixed rate
        'frequency': 2,
        'day_count': 'ACT/365',
        'is_payer': False
    }
    
    pricer_a = CurrencySwapPricer(
        trade_date=trade_date,
        maturity_date=maturity_date,
        spot_fx_rate=1.08,
        leg1_config=leg1_cfg,
        leg2_config=leg2_cfg,
        curve_builder1=builder1,
        curve_builder2=builder2,
        curve_builder2_basis=basis_builder
    )
    
    risk_a = RiskEngine.calculate_ccs_risk(
        pricer=pricer_a,
        active_market_data1=usd_records,
        active_market_data2=eur_records,
        config1=config1,
        config2=config2,
        basis_market_data=basis_records,
        config_basis=config_basis
    )
    
    print(f"Base NPV: {risk_a['base_npv']}")
    print(f"Leg 2 (EUR) parallel delta: {risk_a['parallel']['leg2_delta']} (expected: ~ -4555)")
    print("Leg 2 Delta vector:")
    for entry in risk_a['leg2_delta_vector']:
        if entry['delta'] != 0.0:
            print(f"  {entry['tenor']} ({entry['instrument']}): {entry['delta']}")
            
    # ------------------ TEST CASE B: FLOATING LEG 2 ------------------
    print("\n--- Test Case B: Leg 1 USD Floating, Leg 2 EUR Floating (0.0% spread) ---")
    leg2_cfg_float = {
        'notional': 9000000.0, # in EUR
        'rate_type': 'float',
        'rate_or_spread': 0.0, # 0.0 spread
        'frequency': 2,
        'day_count': 'ACT/365',
        'is_payer': False
    }
    
    pricer_b = CurrencySwapPricer(
        trade_date=trade_date,
        maturity_date=maturity_date,
        spot_fx_rate=1.08,
        leg1_config=leg1_cfg,
        leg2_config=leg2_cfg_float,
        curve_builder1=builder1,
        curve_builder2=builder2,
        curve_builder2_basis=basis_builder
    )
    
    risk_b = RiskEngine.calculate_ccs_risk(
        pricer=pricer_b,
        active_market_data1=usd_records,
        active_market_data2=eur_records,
        config1=config1,
        config2=config2,
        basis_market_data=basis_records,
        config_basis=config_basis
    )
    
    print(f"Base NPV: {risk_b['base_npv']}")
    print(f"Leg 1 (USD) parallel delta: {risk_b['parallel']['leg1_delta']} (expected: 0.0)")
    print(f"Leg 2 (EUR) parallel delta: {risk_b['parallel']['leg2_delta']} (expected: ~ -28)")
    print("Leg 2 Delta vector:")
    for entry in risk_b['leg2_delta_vector']:
        if entry['delta'] != 0.0:
            print(f"  {entry['tenor']} ({entry['instrument']}): {entry['delta']}")

    # ------------------ TEST CASE D: NO BASIS CURVE AT ALL ------------------
    print("\n--- Test Case D: No Basis Curve (curve2_basis is None), Leg 2 EUR Floating (0.0% spread) ---")
    pricer_d = CurrencySwapPricer(
        trade_date=trade_date,
        maturity_date=maturity_date,
        spot_fx_rate=1.08,
        leg1_config=leg1_cfg,
        leg2_config=leg2_cfg_float,
        curve_builder1=builder1,
        curve_builder2=builder2,
        curve_builder2_basis=None # NO BASIS CURVE
    )
    
    risk_d = RiskEngine.calculate_ccs_risk(
        pricer=pricer_d,
        active_market_data1=usd_records,
        active_market_data2=eur_records,
        config1=config1,
        config2=config2,
        basis_market_data=None, # NO BASIS MARKET DATA
        config_basis=None
    )
    
    print(f"Base NPV: {risk_d['base_npv']}")
    print(f"Leg 2 (EUR) parallel delta: {risk_d['parallel']['leg2_delta']} (expected: 0.0)")
    print("Leg 2 Delta vector:")
    for entry in risk_d['leg2_delta_vector']:
        if entry['delta'] != 0.0:
            print(f"  {entry['tenor']} ({entry['instrument']}): {entry['delta']}")

if __name__ == "__main__":
    main()
