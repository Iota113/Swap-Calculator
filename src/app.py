import os
import sys
import datetime
import numpy as np
import traceback
from flask import Flask, request, jsonify, send_from_directory

# Ensure that the 'src' directory (or current directory) is in the python path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

from futures_curve_builder import FuturesCurveBuilder
from treasury_curve_builder import TreasuryCurveBuilder
from cubic_spline import CubicSplineCurve
from quant.day_counter import calculate_year_fraction
from quant.swap_pricer import SwapPricer
from quant.cashflow_engine import CashflowEngine

app = Flask(__name__, static_folder='web', static_url_path='')

def resolve_liquidity_overlaps(market_data_records, curve_type, trade_date, day_count_convention, config):
    """
    Scans the market data records for instruments that have overlapping maturity dates.
    If an overlap is found (i.e. maturity difference < 0.05 years), it selects the one
    with the higher liquidity (lower Spread in bps).
    Sets 'skipped' and 'skipped_reason' on the rejected records.
    """
    # Create helper instance just to use tenor parsing
    if curve_type == 'Treasury':
        builder = TreasuryCurveBuilder([], config)
    else:
        builder = FuturesCurveBuilder([], config)
        
    records_with_t = []
    for idx, rec in enumerate(market_data_records):
        inst = rec['Instrument']
        tenor = rec['Tenor']
        
        try:
            if curve_type == 'Treasury':
                mat_date = builder._tenor_to_date(tenor)
            else:
                if inst in ['Cash', 'Swap']:
                    mat_date = builder._tenor_to_date(tenor)
                else: # Future
                    _, mat_date = builder._parse_imm_future(tenor)
            
            t = calculate_year_fraction(trade_date, mat_date, day_count_convention)
            
            # Read spread or default to 9999.0 (highest illiquidity)
            spread_val = rec.get('Spread')
            spread = float(spread_val) if spread_val is not None else 9999.0
            
            records_with_t.append({
                'index': idx,
                'record': rec,
                't': t,
                'spread': spread
            })
        except Exception:
            # If date parsing fails, skip overlap check for this record (it will fail in standard build validation anyway)
            continue
            
    # Sort records by maturity time
    records_with_t.sort(key=lambda x: x['t'])
    
    # Flag to skip overlaps
    skipped_indices = {}
    overlap_threshold = 0.05 # ~18 days window for maturity overlap
    
    i = 0
    while i < len(records_with_t):
        j = i + 1
        overlaps = [records_with_t[i]]
        
        # Collect all records that overlap with the current one within the threshold
        while j < len(records_with_t) and (records_with_t[j]['t'] - records_with_t[i]['t']) < overlap_threshold:
            overlaps.append(records_with_t[j])
            j += 1
            
        if len(overlaps) > 1:
            # Sort overlaps by spread (lowest spread first = most liquid)
            overlaps.sort(key=lambda x: x['spread'])
            winner = overlaps[0]
            
            # Reject all others
            for loser in overlaps[1:]:
                loser_inst = loser['record']['Instrument']
                loser_tenor = loser['record']['Tenor']
                winner_inst = winner['record']['Instrument']
                winner_tenor = winner['record']['Tenor']
                
                skipped_indices[loser['index']] = (
                    f"Skipped (Overlap with {winner_inst} {winner_tenor}; "
                    f"spread {loser['spread']} bps > {winner['spread']} bps)"
                )
            i = j
        else:
            i += 1
            
    # Apply results back to the original records list
    for idx, rec in enumerate(market_data_records):
        if idx in skipped_indices:
            rec['skipped'] = True
            rec['skipped_reason'] = skipped_indices[idx]
        else:
            rec['skipped'] = False
            rec['skipped_reason'] = None
            
    return market_data_records


@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/api/calculate', methods=['POST'])
def calculate():
    try:
        req_data = request.get_json() or {}
        
        # 1. Parse configuration
        config_data = req_data.get('config', {})
        curve_type = config_data.get('curve_type', 'OIS') # 'OIS' or 'Treasury'
        trade_date_str = config_data.get('trade_date', '28-05-2026')
        day_count_convention = config_data.get('day_count_convention', 'ACT/365')
        payment_frequency = int(config_data.get('payment_frequency', 2))
        interpolation_method = config_data.get('interpolation_method', 'Cubic Spline')
        futures_cutoff_years = float(config_data.get('futures_cutoff_years', 2.0))
        
        # Parse trade date to datetime.date
        try:
            trade_date = datetime.datetime.strptime(trade_date_str, "%d-%m-%Y").date()
        except ValueError:
            return jsonify({
                'success': False,
                'error': f"Invalid Trade Date format: '{trade_date_str}'. Expected DD-MM-YYYY."
            }), 400
            
        # Clean config dictionary
        config = {
            'trade_date': trade_date_str,
            'day_count_convention': day_count_convention,
            'payment_frequency': payment_frequency,
            'interpolation_method': interpolation_method,
            'futures_cutoff_years': futures_cutoff_years
        }
        
        # 2. Parse and validate market data
        market_data_raw = req_data.get('market_data', [])
        if not market_data_raw:
            return jsonify({
                'success': False,
                'error': 'Market data is empty. Please load or add at least one instrument.'
            }), 400
            
        market_data_records = []
        for idx, row in enumerate(market_data_raw):
            inst = row.get('Instrument', '').strip().capitalize()
            tenor = row.get('Tenor', '').strip().upper()
            
            # Parse Spread optionally
            spread_val = row.get('Spread')
            spread = None
            if spread_val is not None and str(spread_val).strip() != '':
                try:
                    spread = float(spread_val)
                except ValueError:
                    return jsonify({
                        'success': False,
                        'error': f"Row {idx + 1} ({tenor}): Spread must be a valid number. Got '{spread_val}'"
                    }), 400
            
            if curve_type == 'Treasury':
                # Treasury curve validation
                if not inst or inst not in ['Bill', 'Note', 'Bond']:
                    return jsonify({
                        'success': False,
                        'error': f"Row {idx + 1}: Instrument must be 'Bill', 'Note', or 'Bond' for Treasury Curve. Got '{inst}'"
                    }), 400
                    
                if not tenor:
                    return jsonify({
                        'success': False,
                        'error': f"Row {idx + 1}: Tenor must be specified (e.g., '3M', '2Y', '10Y')."
                    }), 400
                    
                price_val = row.get('Price')
                try:
                    price = float(price_val)
                except (ValueError, TypeError):
                    return jsonify({
                        'success': False,
                        'error': f"Row {idx + 1} ({tenor}): Price must be a valid number. Got '{price_val}'"
                    }), 400
                    
                coupon_val = row.get('Coupon', 0.0)
                if coupon_val == '' or coupon_val is None:
                    coupon = 0.0
                else:
                    try:
                        coupon = float(coupon_val)
                    except ValueError:
                        return jsonify({
                            'success': False,
                            'error': f"Row {idx + 1} ({tenor}): Coupon must be a valid number. Got '{coupon_val}'"
                        }), 400
                        
                market_data_records.append({
                    'Instrument': inst,
                    'Tenor': tenor,
                    'Coupon': coupon,
                    'Price': price,
                    'Spread': spread
                })
            else:
                # OIS curve validation
                if not inst or inst not in ['Cash', 'Future', 'Swap']:
                    return jsonify({
                        'success': False,
                        'error': f"Row {idx + 1}: Instrument must be 'Cash', 'Future', or 'Swap' for OIS Curve. Got '{inst}'"
                    }), 400
                    
                if not tenor:
                    return jsonify({
                        'success': False,
                        'error': f"Row {idx + 1}: Tenor must be specified (e.g., 'O/N', '1M', 'SR3M6')."
                    }), 400
                    
                quote_type = row.get('QuoteType', '').strip().upper()
                if not quote_type or quote_type not in ['RATE', 'PRICE']:
                    return jsonify({
                        'success': False,
                        'error': f"Row {idx + 1}: QuoteType must be 'RATE' or 'PRICE'."
                    }), 400
                    
                quote_val = row.get('Quote')
                try:
                    quote = float(quote_val)
                except (ValueError, TypeError):
                    return jsonify({
                        'success': False,
                        'error': f"Row {idx + 1} ({tenor}): Quote value must be a valid number. Got '{quote_val}'"
                    }), 400
                    
                market_data_records.append({
                    'Instrument': inst,
                    'Tenor': tenor,
                    'QuoteType': quote_type,
                    'Quote': quote,
                    'Spread': spread
                })

        # 3. Resolve maturity overlaps using the Liquidity Auto-Selector
        market_data_records = resolve_liquidity_overlaps(
            market_data_records=market_data_records,
            curve_type=curve_type,
            trade_date=trade_date,
            day_count_convention=day_count_convention,
            config=config
        )
        
        # Filter active instruments for builders
        active_records = [r for r in market_data_records if not r.get('skipped', False)]
        if not active_records:
            return jsonify({
                'success': False,
                'error': 'All loaded instruments were flagged as skipped by the liquidity overlap filter.'
            }), 400

        # 4. Build interest rate curve
        if curve_type == 'Treasury':
            builder = TreasuryCurveBuilder(market_data=active_records, config=config)
        else:
            builder = FuturesCurveBuilder(market_data=active_records, config=config)
            
        discount_factors = builder.build_curve()
        
        # --- MULTI-SWAP PORTFOLIO PRICING LOGIC ---
        portfolio_data = req_data.get('portfolio', [])

        # DEBUG: see exactly what the frontend sent in your terminal
        print("RAW PORTFOLIO PAYLOAD:", portfolio_data)

        # Accept either a list of swaps (current frontend) or a single swap object
        # (older single-input frontend) so a stale main.js can't silently break pricing.
        if isinstance(portfolio_data, dict):
            portfolio_data = [portfolio_data]
        if not isinstance(portfolio_data, list):
            portfolio_data = []

        portfolio_results = None

        if portfolio_data:
            pricer = SwapPricer(builder)

            total_base_npv = 0.0
            total_bumped_npv = 0.0
            priced_count = 0  # how many valid swaps we actually priced

            # Loop through every swap the user added
            for idx, pos in enumerate(portfolio_data):
                # Robust type conversion: tolerate strings, None, or missing keys
                try:
                    notional = float(pos.get('notional', 0) or 0)
                    fixed_rate = float(pos.get('fixed_rate', 0) or 0) / 100.0
                    tenor_years = int(float(pos.get('tenor_years', 0) or 0))
                    position = str(pos.get('position', 'payer')).strip().lower()
                except (ValueError, TypeError) as conv_err:
                    print(f"Portfolio row {idx + 1}: skipped (bad values) -> {conv_err}")
                    continue

                # Skip genuinely empty rows (e.g. a blank row added with '+')
                if notional <= 0 or tenor_years <= 0:
                    print(f"Portfolio row {idx + 1}: skipped (notional={notional}, tenor={tenor_years})")
                    continue

                is_payer = (position == 'payer')
                maturity_date = builder.trade_date + datetime.timedelta(days=tenor_years * 365)

                # Guard each swap so one bad position can't 500 the whole request
                try:
                    results = pricer.calculate_dv01(
                        notional, fixed_rate, maturity_date,
                        payment_frequency, is_payer=is_payer
                    )
                except Exception as price_err:
                    print(f"Portfolio row {idx + 1}: pricing failed -> {price_err}")
                    continue

                # Accumulate across positions (do NOT overwrite previous iterations)
                total_base_npv += float(results['base_npv'])
                total_bumped_npv += float(results['bumped_npv'])
                priced_count += 1

            # Portfolio PVBP is the absolute net change of the entire portfolio
            # (Payer and Receiver swaps naturally offset each other's risk)
            net_pvbp = abs(total_bumped_npv - total_base_npv)

            # Return results whenever we priced at least one swap, even if the
            # net NPV happens to be ~0 (so the UI updates instead of showing the default).
            if priced_count > 0:
                portfolio_results = {
                    "base_npv": round(total_base_npv, 2),
                    "bumped_npv": round(total_bumped_npv, 2),
                    "pvbp": round(net_pvbp, 2),
                    "positions_priced": priced_count
                }

        print("COMPUTED PORTFOLIO RESULTS:", portfolio_results)

        # --- PORTFOLIO CASHFLOW TIMESERIES (for the cashflow projection chart) ---
        # Guarded so a problem in the engine can't break the curve/PVBP response.
        cashflow_timeseries = []
        try:
            engine = CashflowEngine(builder)
            cashflow_timeseries = engine.generate_portfolio_cashflows(portfolio_data)
        except Exception as cf_err:
            print(f"Cashflow engine failed: {cf_err}")
            cashflow_timeseries = []

        # 5. Generate results knots for output display (evaluating both active & skipped)
        knots = []
        for item in market_data_records:
            inst = item['Instrument']
            tenor = item['Tenor']
            skipped = item.get('skipped', False)
            skipped_reason = item.get('skipped_reason')
            
            try:
                if curve_type == 'Treasury':
                    mat_date = builder._tenor_to_date(tenor)
                else:
                    if inst in ['Cash', 'Swap']:
                        mat_date = builder._tenor_to_date(tenor)
                    else: # Future
                        _, mat_date = builder._parse_imm_future(tenor)
                        
                t = calculate_year_fraction(builder.trade_date, mat_date, builder.convention)
                df = builder._get_discount_factor(t)
                zero_rate = 0.0 if t == 0 else (-np.log(df) / t) * 100.0
                
                # Check OIS cutoff rules on active nodes
                if curve_type == 'OIS' and not skipped:
                    if inst == 'Future' and t > builder.futures_cutoff_years + 0.1:
                        skipped = True
                        skipped_reason = f"Skipped (Future beyond {builder.futures_cutoff_years}Y cutoff)"
                    elif inst == 'Swap' and t <= builder.futures_cutoff_years + 0.1:
                        skipped = True
                        skipped_reason = f"Skipped (Swap overlaps with futures within {builder.futures_cutoff_years}Y cutoff)"
                
                knot_info = {
                    'instrument': inst,
                    'tenor': tenor,
                    'maturity_date': mat_date.strftime('%Y-%m-%d'),
                    't': round(t, 6),
                    'df': round(df, 6),
                    'zero_rate': round(zero_rate, 4),
                    'skipped': skipped,
                    'skipped_reason': skipped_reason
                }
                
                if curve_type == 'Treasury':
                    knot_info['price'] = item['Price']
                    knot_info['coupon'] = item['Coupon']
                else:
                    knot_info['quote_type'] = item['QuoteType']
                    knot_info['quote'] = item['Quote']
                    
                if item.get('Spread') is not None:
                    knot_info['spread'] = item['Spread']
                    
                knots.append(knot_info)
            except Exception as e:
                knot_err = {
                    'instrument': inst,
                    'tenor': tenor,
                    'error': str(e)
                }
                if curve_type == 'Treasury':
                    knot_err['price'] = item['Price']
                    knot_err['coupon'] = item['Coupon']
                else:
                    knot_err['quote_type'] = item['QuoteType']
                    knot_err['quote'] = item['Quote']
                knots.append(knot_err)

        # Sort knots by year fraction
        knots.sort(key=lambda x: x.get('t', 9999.0))
        
        # 6. Interpolate smooth curve points for visualization
        valid_knots = [k for k in knots if 'error' not in k and not k.get('skipped', False) and k.get('t', 0.0) > 0]
        if len(valid_knots) < 1:
            return jsonify({
                'success': False,
                'error': 'No active instruments remaining after applying filters and cutoff rules.'
            }), 400
            
        times = np.array([k['t'] for k in valid_knots])
        dfs = np.array([k['df'] for k in valid_knots])
        rates = np.array([k['zero_rate'] for k in valid_knots])
        
        min_time = float(times.min())
        max_time = float(times.max())
        
        if min_time <= 0:
            min_time = 0.0001
            
        times_smooth = np.linspace(min_time, max_time, 200)
        
        zero_rates_smooth = []
        dfs_smooth = []
        
        if interpolation_method == 'Cubic Spline' and len(times) >= 3:
            try:
                zero_spline = CubicSplineCurve(times, rates)
                zero_rates_smooth = zero_spline.evaluate(times_smooth).tolist()
                
                df_spline = CubicSplineCurve(times, dfs)
                dfs_smooth = df_spline.evaluate(times_smooth).tolist()
            except Exception as spline_err:
                interpolation_method = 'Linear (Fallback)'
                zero_rates_smooth = np.interp(times_smooth, times, rates).tolist()
                dfs_smooth = np.interp(times_smooth, times, dfs).tolist()
        else:
            zero_rates_smooth = np.interp(times_smooth, times, rates).tolist()
            dfs_smooth = np.interp(times_smooth, times, dfs).tolist()
            
        return jsonify({
            'success': True,
            'config': config,
            'knots': knots,
            'portfolio_results': portfolio_results,
            'cashflows': cashflow_timeseries,
            'curves': {
                'times': times_smooth.tolist(),
                'zero_rates': zero_rates_smooth,
                'discount_factors': dfs_smooth,
                'method': interpolation_method
            }
        })
        
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f"Curve building error: {str(e)}"
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)