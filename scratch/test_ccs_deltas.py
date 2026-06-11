import datetime
import sys
import os

current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.append(os.path.join(parent_dir, 'src'))

from quant.futures_curve_builder import FuturesCurveBuilder
from quant.basis_curve_builder import CrossCurrencyBasisCurveBuilder
from quant.currency_swap_pricer import CurrencySwapPricer
from quant.risk_engine import RiskEngine, rebuild_curve, bump_market_data_parallel, bump_market_data_pillar


def test_fixed_leg2_no_basis():
    trade_date_str = "28-05-2026"
    trade_date = datetime.datetime.strptime(trade_date_str, "%d-%m-%Y").date()
    spot_fx_rate = 1.08
    
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

    market_data1 = [
        {"Instrument": "Cash", "Tenor": "O/N", "QuoteType": "RATE", "Quote": 3.55},
        {"Instrument": "Swap", "Tenor": "1Y", "QuoteType": "RATE", "Quote": 3.849},
        {"Instrument": "Swap", "Tenor": "5Y", "QuoteType": "RATE", "Quote": 3.906},
    ]
    
    market_data2 = [
        {"Instrument": "Cash", "Tenor": "O/N", "QuoteType": "RATE", "Quote": 2.50},
        {"Instrument": "Swap", "Tenor": "1Y", "QuoteType": "RATE", "Quote": 2.80},
        {"Instrument": "Swap", "Tenor": "5Y", "QuoteType": "RATE", "Quote": 3.00},
    ]

    builder1 = FuturesCurveBuilder(market_data1, config1)
    builder1.build_curve()
    
    builder2 = FuturesCurveBuilder(market_data2, config2)
    builder2.build_curve()
    
    # Leg 1: Float (USD)
    # Leg 2: Fixed (EUR)
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
    
    pricer = CurrencySwapPricer(
        trade_date=trade_date,
        maturity_date=maturity_date,
        spot_fx_rate=spot_fx_rate,
        leg1_config=leg1_config,
        leg2_config=leg2_config,
        curve_builder1=builder1,
        curve_builder2=builder2,
        curve_builder2_basis=None # No basis curve
    )
    
    # Let's run calculate_ccs_risk without basis_market_data
    risk = RiskEngine.calculate_ccs_risk(
        pricer=pricer,
        active_market_data1=market_data1,
        active_market_data2=market_data2,
        config1=config1,
        config2=config2,
        basis_market_data=None,
        config_basis=None
    )
    
    print("NO BASIS CASE (Leg 1 = Float, Leg 2 = Fixed):")
    print("Leg 1 Parallel DV01:", risk["parallel"]["leg1_dv01"])
    print("Leg 2 Parallel DV01:", risk["parallel"]["leg2_dv01"])
    print("Leg 2 Delta Vector:", risk["leg2_delta_vector"])

    # Leg 2: Floating (EUR)
    leg2_config_float = {
        'notional': 9259259.26,
        'rate_type': 'floating',
        'rate_or_spread': 0.0,
        'frequency': 2,
        'day_count': 'ACT/360',
        'is_payer': True
    }
    
    pricer_float = CurrencySwapPricer(
        trade_date=trade_date,
        maturity_date=maturity_date,
        spot_fx_rate=spot_fx_rate,
        leg1_config=leg1_config,
        leg2_config=leg2_config_float,
        curve_builder1=builder1,
        curve_builder2=builder2,
        curve_builder2_basis=None # No basis curve
    )
    
    risk_float = RiskEngine.calculate_ccs_risk(
        pricer=pricer_float,
        active_market_data1=market_data1,
        active_market_data2=market_data2,
        config1=config1,
        config2=config2,
        basis_market_data=None,
        config_basis=None
    )
    
    print("\nNO BASIS CASE (Leg 1 = Float, Leg 2 = Float):")
    print("Leg 1 Parallel DV01:", risk_float["parallel"]["leg1_dv01"])
    print("Leg 2 Parallel DV01:", risk_float["parallel"]["leg2_dv01"])
    print("Leg 2 Delta Vector:", risk_float["leg2_delta_vector"])

def fixed_calculate_ccs_risk(
    pricer,
    active_market_data1: list,
    active_market_data2: list,
    config1: dict,
    config2: dict,
    bp_shift: float = 0.0001,
    fx_shift_pct: float = 0.01,
    basis_market_data = None,
    config_basis = None,
) -> dict:
    basis_builder = None
    if basis_market_data and config_basis:
        from quant.basis_curve_builder import CrossCurrencyBasisCurveBuilder
        basis_builder = CrossCurrencyBasisCurveBuilder(basis_market_data, pricer.curve2, config_basis)
        basis_builder.build_curve()

    _, base_summary = pricer.price_swap(curve2_basis=basis_builder)
    base_npv = base_summary["total_net_npv"]

    bumped_builder1 = rebuild_curve(
        bump_market_data_parallel(active_market_data1, bp_shift), config1
    )
    _, leg1_parallel_summary = pricer.price_swap(curve1=bumped_builder1, curve2_basis=basis_builder)
    leg1_parallel_delta = leg1_parallel_summary["total_net_npv"] - base_npv

    bumped_builder2 = rebuild_curve(
        bump_market_data_parallel(active_market_data2, bp_shift), config2
    )
    if basis_builder and basis_market_data and config_basis:
        from quant.basis_curve_builder import CrossCurrencyBasisCurveBuilder
        bumped_basis_builder = CrossCurrencyBasisCurveBuilder(basis_market_data, bumped_builder2, config_basis)
        bumped_basis_builder.build_curve()
        _, leg2_parallel_summary = pricer.price_swap(curve2=bumped_builder2, curve2_basis=bumped_basis_builder)
    else:
        _, leg2_parallel_summary = pricer.price_swap(curve2=bumped_builder2, curve2_basis=bumped_builder2)
    
    print(f"DEBUG {pricer.leg2['rate_type'].upper()}:")
    print("  Base Leg 2 PV:", base_summary["leg2_total_pv"])
    print("  Bumped Leg 2 PV:", leg2_parallel_summary["leg2_total_pv"])
    
    if pricer.leg2['rate_type'] == 'floating':
        cfs, sum_res = pricer.price_swap()
        print("  LEG 2 Cashflows:")
        for cf in cfs:
            if cf["leg2_amount"] != 0:
                print(f"    Date: {cf['date']}, Amount: {cf['leg2_amount']}, PV: {cf['leg2_converted'] * cf['df']}")
    
    leg2_parallel_delta = leg2_parallel_summary["total_net_npv"] - base_npv



    # Fix pillar delta vectors as well
    def fixed_pillar_delta_vector(leg_key):
        market_data = active_market_data1 if leg_key == "1" else active_market_data2
        config = config1 if leg_key == "1" else config2
        deltas = []
        for idx, record in enumerate(market_data):
            if record.get("skipped"):
                continue

            bumped_data = bump_market_data_pillar(market_data, idx, bp_shift)
            bumped_builder = rebuild_curve(bumped_data, config)

            if leg_key == "1":
                price_kwargs = {"curve1": bumped_builder, "curve2_basis": basis_builder}
            else:
                price_kwargs = {"curve2": bumped_builder}
                if basis_builder and basis_market_data and config_basis:
                    from quant.basis_curve_builder import CrossCurrencyBasisCurveBuilder
                    bumped_basis_builder = CrossCurrencyBasisCurveBuilder(basis_market_data, bumped_builder, config_basis)
                    bumped_basis_builder.build_curve()
                    price_kwargs["curve2_basis"] = bumped_basis_builder
                else:
                    price_kwargs["curve2_basis"] = bumped_builder

            _, summary = pricer.price_swap(**price_kwargs)
            delta = summary["total_net_npv"] - base_npv
            deltas.append({
                "pillar_index": idx,
                "instrument": record["Instrument"],
                "tenor": record["Tenor"],
                "quote": record["Quote"],
                "quote_type": record.get("QuoteType", "RATE"),
                "delta": round(delta, 2),
                "pvbp": round(abs(delta), 2),
            })
        return deltas

    return {
        "leg1_parallel_dv01": round(abs(leg1_parallel_delta), 2),
        "leg2_parallel_dv01": round(abs(leg2_parallel_delta), 2),
        "leg2_delta_vector": fixed_pillar_delta_vector("2")
    }

def test_fixed_implementation():
    trade_date_str = "28-05-2026"
    trade_date = datetime.datetime.strptime(trade_date_str, "%d-%m-%Y").date()
    spot_fx_rate = 1.08
    
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

    market_data1 = [
        {"Instrument": "Cash", "Tenor": "O/N", "QuoteType": "RATE", "Quote": 3.55},
        {"Instrument": "Swap", "Tenor": "1Y", "QuoteType": "RATE", "Quote": 3.849},
        {"Instrument": "Swap", "Tenor": "5Y", "QuoteType": "RATE", "Quote": 3.906},
    ]
    
    market_data2 = [
        {"Instrument": "Cash", "Tenor": "O/N", "QuoteType": "RATE", "Quote": 2.50},
        {"Instrument": "Swap", "Tenor": "1Y", "QuoteType": "RATE", "Quote": 2.80},
        {"Instrument": "Swap", "Tenor": "5Y", "QuoteType": "RATE", "Quote": 3.00},
    ]

    basis_data = [
        {"Instrument": "Swap", "Tenor": "1Y", "QuoteType": "RATE", "Quote": -0.15},
        {"Instrument": "Swap", "Tenor": "2Y", "QuoteType": "RATE", "Quote": -0.18},
        {"Instrument": "Swap", "Tenor": "5Y", "QuoteType": "RATE", "Quote": -0.22},
    ]

    builder1 = FuturesCurveBuilder(market_data1, config1)
    builder1.build_curve()
    
    builder2 = FuturesCurveBuilder(market_data2, config2)
    builder2.build_curve()
    
    # Test 1: Float vs Fixed, with Basis
    basis_builder = CrossCurrencyBasisCurveBuilder(basis_data, builder2, config2)
    basis_builder.build_curve()

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

    from quant.risk_engine import bump_market_data_parallel, bump_market_data_pillar, rebuild_curve

    res = fixed_calculate_ccs_risk(
        pricer, market_data1, market_data2, config1, config2,
        basis_market_data=basis_data, config_basis=config2
    )
    print("\n--- FIXED IMPLEMENTATION TEST (Float vs Fixed with Basis) ---")
    print("Leg 1 Parallel DV01:", res["leg1_parallel_dv01"])
    print("Leg 2 Parallel DV01 (Expected: Non-Zero):", res["leg2_parallel_dv01"])
    print("Leg 2 Delta Vector:", res["leg2_delta_vector"])

    # Test 2: Float vs Float, without Basis
    pricer_float = CurrencySwapPricer(
        trade_date=trade_date,
        maturity_date=maturity_date,
        spot_fx_rate=spot_fx_rate,
        leg1_config=leg1_config,
        leg2_config={**leg2_config, 'rate_type': 'floating'},
        curve_builder1=builder1,
        curve_builder2=builder2,
        curve_builder2_basis=None
    )
    res_float = fixed_calculate_ccs_risk(
        pricer_float, market_data1, market_data2, config1, config2,
        basis_market_data=None, config_basis=None
    )
    print("\n--- FIXED IMPLEMENTATION TEST (Float vs Float, NO Basis) ---")
    print("Leg 1 Parallel DV01:", res_float["leg1_parallel_dv01"])
    print("Leg 2 Parallel DV01 (Expected: 0.0 because self-discounting float):", res_float["leg2_parallel_dv01"])
    print("Leg 2 Delta Vector:", res_float["leg2_delta_vector"])



if __name__ == "__main__":
    test_fixed_implementation()

