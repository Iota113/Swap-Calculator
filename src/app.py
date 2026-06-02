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
                
            # Clean quote rates
            if inst in ['Cash', 'Swap']:
                cleaned_rate = quote / 100.0
            else: # Future
                cleaned_rate = (100.0 - quote) / 100.0
                
            market_data_records.append({
                'Instrument': inst,
                'Tenor': tenor,
                'QuoteType': quote_type,
                'Quote': quote,
                'CleanedRate': cleaned_rate
            })

        # 3. Build interest rate curve
        builder = FuturesCurveBuilder(market_data=market_data_records, config=config)
        discount_factors = builder.build_curve()
        
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
                'success': False,
                'error': 'No active instruments remaining after applying filters and cutoff rules.'
            }), 400
            
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
