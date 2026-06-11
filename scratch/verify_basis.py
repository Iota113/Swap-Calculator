import datetime
import sys
import os

# Put src in python path
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.append(os.path.join(parent_dir, 'src'))

from quant.futures_curve_builder import FuturesCurveBuilder
from quant.basis_curve_builder import CrossCurrencyBasisCurveBuilder
from quant.currency_swap_pricer import CurrencySwapPricer
from quant.risk_engine import RiskEngine

def test_basis_verification():
    trade_date_str = "28-05-2026"
    trade_date = datetime.datetime.strptime(trade_date_str, "%d-%m-%Y").date()
    spot_fx_rate = 1.08
    
    # Mock configs
    config1 = {
        'trade_date': trade_date_str,
        'day_count_convention': 'ACT/365',
        'payment_frequency': 2,
        'interpolation_method': 'Cubic Spline',
        'futures_cutoff_years': 2.0
    }
    
    config2 = {
        'trade_date': trade_date_str,
        'day_count_convention': 'ACT/360',
        'payment_frequency': 2,
        'interpolation_method': 'Cubic Spline',
        'futures_cutoff_years': 2.0
    }
    
    config_basis = {
        'trade_date': trade_date_str,
        'day_count_convention': 'ACT/365',
        'payment_frequency': 2,
        'interpolation_method': 'Cubic Spline'
    }

    # Mock market data for Leg 1 (USD OIS)
    market_data1 = [
        {"Instrument": "Cash", "Tenor": "O/N", "QuoteType": "RATE", "Quote": 3.55},
        {"Instrument": "Cash", "Tenor": "1M", "QuoteType": "RATE", "Quote": 3.60},
        {"Instrument": "Swap", "Tenor": "1Y", "QuoteType": "RATE", "Quote": 3.849},
        {"Instrument": "Swap", "Tenor": "2Y", "QuoteType": "RATE", "Quote": 3.899},
        {"Instrument": "Swap", "Tenor": "5Y", "QuoteType": "RATE", "Quote": 3.906},
    ]
    
    # Mock market data for Leg 2 (EUR)
    market_data2 = [
        {"Instrument": "Cash", "Tenor": "O/N", "QuoteType": "RATE", "Quote": 2.50},
        {"Instrument": "Cash", "Tenor": "1M", "QuoteType": "RATE", "Quote": 2.60},
        {"Instrument": "Swap", "Tenor": "1Y", "QuoteType": "RATE", "Quote": 2.80},
        {"Instrument": "Swap", "Tenor": "2Y", "QuoteType": "RATE", "Quote": 2.90},
        {"Instrument": "Swap", "Tenor": "5Y", "QuoteType": "RATE", "Quote": 3.00},
    ]

    # Mock basis market data
    basis_data = [
        {"Instrument": "Swap", "Tenor": "1Y", "QuoteType": "RATE", "Quote": -0.15},
        {"Instrument": "Swap", "Tenor": "2Y", "QuoteType": "RATE", "Quote": -0.18},
        {"Instrument": "Swap", "Tenor": "5Y", "QuoteType": "RATE", "Quote": -0.22},
    ]

    print("--- 1. Building Curve 1 (USD OIS) ---")
    builder1 = FuturesCurveBuilder(market_data1, config1)
    builder1.build_curve()
    print("USD 5Y DF:", builder1._get_discount_factor(5.0))
    
    print("\n--- 2. Building Curve 2 (EUR) ---")
    builder2 = FuturesCurveBuilder(market_data2, config2)
    builder2.build_curve()
    print("EUR 5Y DF:", builder2._get_discount_factor(5.0))

    print("\n--- 3. Building Cross-Currency Basis-Adjusted Curve (EUR Basis) ---")
    basis_builder = CrossCurrencyBasisCurveBuilder(basis_data, builder2, config_basis)
    basis_builder.build_curve()
    print("EUR Basis 5Y DF (adjusted):", basis_builder._get_discount_factor(5.0))
    
    # Mock trade configurations
    leg1_config = {
        'notional': 10000000.0,
        'rate_type': 'floating',
        'rate_or_spread': 0.0,
        'frequency': 2,
        'day_count': 'ACT/365',
        'is_payer': False
    }
    
    leg2_config = {
        'notional': 9259259.26,
        'rate_type': 'fixed',
        'rate_or_spread': 3.0,
        'frequency': 2,
        'day_count': 'ACT/360',
        'is_payer': True
    }
    
    maturity_date = trade_date + datetime.timedelta(days=5*365)
    
    print("\n--- 4. Pricing Cross-Currency Swap ---")
    pricer = CurrencySwapPricer(
        trade_date=trade_date,
        maturity_date=maturity_date,
        spot_fx_rate=spot_fx_rate,
        leg1_config=leg1_config,
        leg2_config=leg2_config,
        curve_builder1=builder1,
        curve_builder2=builder2,
        curve_builder2_basis=basis_builder
    )
    
    cfs, summary = pricer.price_swap()
    print("Base NPV Summary:", summary)
    
    print("\n--- 5. Running Risk engine ---")
    risk = RiskEngine.calculate_ccs_risk(
        pricer=pricer,
        active_market_data1=market_data1,
        active_market_data2=market_data2,
        config1=config1,
        config2=config2,
        basis_market_data=basis_data,
        config_basis=config_basis
    )
    
    print("\nRisk Results:")
    print("Base NPV:", risk["base_npv"])
    print("Leg 1 Parallel DV01:", risk["parallel"]["leg1_dv01"])
    print("Leg 2 Parallel DV01:", risk["parallel"]["leg2_dv01"])
    print("Basis Parallel DV01:", risk["parallel"]["basis_dv01"])
    print("FX Delta (1%):", risk["parallel"]["fx_delta_1pct"])
    print("Leg 1 Delta Vector:", risk["leg1_delta_vector"])
    print("Leg 2 Delta Vector:", risk["leg2_delta_vector"])
    print("Basis Delta Vector:", risk["basis_delta_vector"])

if __name__ == "__main__":
    test_basis_verification()
