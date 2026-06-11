import datetime
import numpy as np
from dateutil.relativedelta import relativedelta
from quant.day_counter import calculate_year_fraction, generate_forward_schedule
from quant.cubic_spline import CubicSplineCurve

class CrossCurrencyBasisCurveBuilder:
    def __init__(self, market_data, curve2, config):
        """
        Bootstrap builder for a foreign basis-adjusted discount curve.
        
        market_data: list of dicts with 'Instrument', 'Tenor', 'Quote' (basis spreads in percent, e.g. -0.22)
        curve2: The foreign forecasting curve builder (e.g. EURIBOR curve)
        config: dict containing 'trade_date', 'day_count_convention', 'payment_frequency', 'interpolation_method'
        """
        self.market_data = market_data
        self.curve2 = curve2
        self.config = config
        
        self.trade_date = datetime.datetime.strptime(config['trade_date'], "%d-%m-%Y").date()
        self.convention = config['day_count_convention']
        self.freq = config['payment_frequency']
        self.interpolation_method = config['interpolation_method']
        self.futures_cutoff_years = config.get('futures_cutoff_years', 0.0)
        
        self.discount_factors = {0.0: 1.0}

    def build_curve(self):
        swap_data = [d for d in self.market_data if d['Instrument'] == 'Swap']
        
        # Parse maturities
        for item in swap_data:
            item['parsed_mat_date'] = self._tenor_to_date(item['Tenor'])
            
        swap_data.sort(key=lambda x: x['parsed_mat_date'])
        
        for item in swap_data:
            mat_date = item['parsed_mat_date']
            t_maturity = calculate_year_fraction(self.trade_date, mat_date, self.convention)
            
            basis_spread = item['Quote'] / 100.0  # e.g. -0.22% -> -0.0022
            
            schedule = generate_forward_schedule(self.trade_date, mat_date, self.freq)
            running_coupon_pv = 0.0
            prev_date = self.trade_date
            
            for current_date in schedule[:-1]:
                t_i = calculate_year_fraction(self.trade_date, current_date, self.convention)
                tau_i = calculate_year_fraction(prev_date, current_date, self.convention)
                
                # Get forward rate from curve2
                t_prev = calculate_year_fraction(self.trade_date, prev_date, self.convention)
                df_prev = self.curve2._get_discount_factor(t_prev)
                df_curr = self.curve2._get_discount_factor(t_i)
                phi_i = (df_prev / df_curr - 1.0) / tau_i if df_curr > 0 else 0.0
                
                # Get discount factor from current basis curve progress
                df_basis = self._get_discount_factor(t_i)
                
                running_coupon_pv += (phi_i + basis_spread) * tau_i * df_basis
                prev_date = current_date
                
            tau_n = calculate_year_fraction(prev_date, mat_date, self.convention)
            t_prev = calculate_year_fraction(self.trade_date, prev_date, self.convention)
            df_prev = self.curve2._get_discount_factor(t_prev)
            df_curr = self.curve2._get_discount_factor(t_maturity)
            phi_n = (df_prev / df_curr - 1.0) / tau_n if df_curr > 0 else 0.0
            
            numerator = 1.0 - running_coupon_pv
            denominator = 1.0 + (phi_n + basis_spread) * tau_n
            final_df = numerator / denominator
            
            self.discount_factors[t_maturity] = final_df
            
        return self.discount_factors

    def _tenor_to_date(self, tenor_str):
        tenor_str = tenor_str.upper().strip()
        try:
            value = int(tenor_str[:-1])
            unit = tenor_str[-1]
            if unit == 'Y': return self.trade_date + relativedelta(years=value)
            elif unit == 'M': return self.trade_date + relativedelta(months=value)
            elif unit == 'W': return self.trade_date + relativedelta(weeks=value)
            elif unit == 'D': return self.trade_date + relativedelta(days=value)
            else: raise ValueError(f"Unknown unit: {unit}")
        except ValueError:
            raise ValueError(f"Error parsing tenor string: {tenor_str}")

    def _get_discount_factor(self, t):
        if t in self.discount_factors:
            return self.discount_factors[t]
        
        known_times = sorted(self.discount_factors.keys())
        zero_rates = [
            0.0 if t_known == 0 else -np.log(self.discount_factors[t_known]) / t_known 
            for t_known in known_times
        ]
        
        interpolated_zero = float(np.interp(t, known_times, zero_rates))
        return np.exp(-interpolated_zero * t)
