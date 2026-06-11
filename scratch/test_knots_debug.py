import datetime
import sys
import os
import json

# Put src in python path
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.append(os.path.join(parent_dir, 'src'))

from app import (
    _parse_and_validate_market_data,
    resolve_liquidity_overlaps,
    load_fallback_csv,
    _generate_curve_knots,
    _generate_smooth_curve
)
from quant.futures_curve_builder import FuturesCurveBuilder
from quant.basis_curve_builder import CrossCurrencyBasisCurveBuilder

def debug_basis_knots():
    trade_date_str = "28-05-2026"
    trade_date = datetime.datetime.strptime(trade_date_str, "%d-%m-%Y").date()
    
    leg2_market_raw = load_fallback_csv('eur_fallback.csv')
    basis_market_raw = load_fallback_csv('basis_fallback.csv')
    
    config2 = {
        'trade_date': trade_date_str,
        'day_count_convention': 'ACT/365',
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
    
    leg2_records, _ = _parse_and_validate_market_data(leg2_market_raw, 'OIS')
    basis_records, _ = _parse_and_validate_market_data(basis_market_raw, 'OIS')
    
    leg2_records = resolve_liquidity_overlaps(
        market_data_records=leg2_records,
        curve_type='OIS',
        trade_date=trade_date,
        day_count_convention=config2['day_count_convention'],
        config=config2
    )
    
    basis_records = resolve_liquidity_overlaps(
        market_data_records=basis_records,
        curve_type='OIS',
        trade_date=trade_date,
        day_count_convention=config_basis['day_count_convention'],
        config=config_basis
    )
    
    active_records2 = [r for r in leg2_records if not r.get('skipped', False)]
    active_basis_records = [r for r in basis_records if not r.get('skipped', False)]
    
    builder2 = FuturesCurveBuilder(market_data=active_records2, config=config2)
    builder2.build_curve()
    
    basis_builder = CrossCurrencyBasisCurveBuilder(market_data=active_basis_records, curve2=builder2, config=config_basis)
    basis_builder.build_curve()
    
    knots_basis = _generate_curve_knots(basis_records, basis_builder, config_basis)
    print("KNOTS BASIS:")
    print(json.dumps(knots_basis, indent=2))

if __name__ == "__main__":
    debug_basis_knots()
