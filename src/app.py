import os
import sys
import datetime
import numpy as np
import traceback
from flask import Flask, request, jsonify, send_from_directory
from quant.swap_pricer import SwapPricer
import datetime

# Ensure that the 'src' directory (or current directory) is in the python path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

from futures_curve_builder import FuturesCurveBuilder
from cubic_spline import CubicSplineCurve
from quant.day_counter import calculate_year_fraction

app = Flask(__name__, static_folder='web', static_url_path='')

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/api/calculate', methods=['POST'])
def calculate():
    try:
        req_data = request.get_json() or {}
        
        # 1. Parse configuration
        config_data = req_data.get('config', {})
        trade_date_str = config_data.get('trade_date', '28-05-2026')
        day_count_convention = config_data.get('day_count_convention', 'ACT/365')
        payment_frequency = int(config_data.get('payment_frequency', 2))
        interpolation_method = config_data.get('interpolation_method', 'Cubic Spline')
        futures_cutoff_years = float(config_data.get('futures_cutoff_years', 2.0))
        
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
                'error': 'Market data is empty. Please provide at least one cash rate, future, or swap.'
            }), 400
            
        market_data_records = []
        for idx, row in enumerate(market_data_raw):
            inst = row.get('Instrument', '').strip().capitalize()
            tenor = row.get('Tenor', '').strip().upper()
            quote_type = row.get('QuoteType', '').strip().upper()
            quote_val = row.get('Quote')
            
            # Validation checks
            if not inst or inst not in ['Cash', 'Future', 'Swap']:
                return jsonify({
                    'success': False,
                    'error': f"Row {idx + 1}: Instrument must be 'Cash', 'Future', or 'Swap'. Got '{inst}'"
                }), 400
                
            if not tenor:
                return jsonify({
                    'success': False,
                    'error': f"Row {idx + 1}: Tenor must be specified (e.g., 'O/N', '1M', 'SR3M6', '5Y')."
                }), 400
                
            if not quote_type or quote_type not in ['RATE', 'PRICE']:
                return jsonify({
                    'success': False,
                    'error': f"Row {idx + 1}: QuoteType must be 'RATE' or 'PRICE'."
                }), 400
                
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
                'Quote': quote
            })

        # 3. Build interest rate curve
        builder = FuturesCurveBuilder(market_data=market_data_records, config=config)
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

        # 4. Generate results for the input instruments (knots)
        knots = []
        for item in market_data_records:
            inst = item['Instrument']
            tenor = item['Tenor']
            
            # Find the maturity date and time fraction
            try:
                if inst in ['Cash', 'Swap']:
                    mat_date = builder._tenor_to_date(tenor)
                else: # Future
                    _, mat_date = builder._parse_imm_future(tenor)
                    
                t = calculate_year_fraction(builder.trade_date, mat_date, builder.convention)
                df = builder._get_discount_factor(t)
                zero_rate = 0.0 if t == 0 else (-np.log(df) / t) * 100.0
                
                # Check if it was skipped due to the cutoff rule
                skipped = False
                if inst == 'Future' and t > builder.futures_cutoff_years + 0.1:
                    skipped = True
                elif inst == 'Swap' and t <= builder.futures_cutoff_years + 0.1:
                    skipped = True
                
                knots.append({
                    'instrument': inst,
                    'tenor': tenor,
                    'quote_type': item['QuoteType'],
                    'quote': item['Quote'],
                    'maturity_date': mat_date.strftime('%Y-%m-%d'),
                    't': round(t, 6),
                    'df': round(df, 6),
                    'zero_rate': round(zero_rate, 4),
                    'skipped': skipped
                })
            except Exception as e:
                # If a specific instrument parsing fails, we add it with error details
                knots.append({
                    'instrument': inst,
                    'tenor': tenor,
                    'quote_type': item['QuoteType'],
                    'quote': item['Quote'],
                    'error': str(e)
                })

        # Sort knots by year fraction
        knots.sort(key=lambda x: x.get('t', 9999.0))
        
        # 5. Interpolate smooth curve points for visualization
        valid_knots = [k for k in knots if 'error' not in k and not k.get('skipped', False) and k.get('t', 0.0) > 0]
        if len(valid_knots) < 1:
            return jsonify({
                        'success': True,
                        'config': config,
                        'knots': knots,
                        'portfolio_results': portfolio_results,
                        'curves': {
                            'times': [],
                            'zero_rates': [],
                            'discount_factors': [],
                            'method': interpolation_method
                        }
                    })
            
        times = np.array([k['t'] for k in valid_knots])
        dfs = np.array([k['df'] for k in valid_knots])
        rates = np.array([k['zero_rate'] for k in valid_knots])
        
        # Generate 200 points from min time to max time for a smooth chart
        min_time = float(times.min())
        max_time = float(times.max())
        
        # Avoid zero or negative values in time scaling
        if min_time <= 0:
            min_time = 0.0001
            
        times_smooth = np.linspace(min_time, max_time, 200)
        
        zero_rates_smooth = []
        dfs_smooth = []
        
        if interpolation_method == 'Cubic Spline' and len(times) >= 3:
            try:
                # Interpolate Zero Rates
                zero_spline = CubicSplineCurve(times, rates)
                zero_rates_smooth = zero_spline.evaluate(times_smooth).tolist()
                
                # Interpolate Discount Factors
                df_spline = CubicSplineCurve(times, dfs)
                dfs_smooth = df_spline.evaluate(times_smooth).tolist()
            except Exception as spline_err:
                # Fallback to linear if cubic spline fails (e.g. duplicate x points)
                interpolation_method = 'Linear (Fallback)'
                zero_rates_smooth = np.interp(times_smooth, times, rates).tolist()
                dfs_smooth = np.interp(times_smooth, times, dfs).tolist()
        else:
            # Linear interpolation
            zero_rates_smooth = np.interp(times_smooth, times, rates).tolist()
            dfs_smooth = np.interp(times_smooth, times, dfs).tolist()
            
        return jsonify({
            'success': True,
            'config': config,
            'knots': knots,
            'portfolio_results': portfolio_results,
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
    # Start local server on port 5000
    app.run(debug=True, host='127.0.0.1', port=5000)