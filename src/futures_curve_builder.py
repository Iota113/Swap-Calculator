from quant.day_counter import calculate_year_fraction
from dateutil.relativedelta import relativedelta
from cubic_spline import CubicSplineCurve 

import matplotlib.pyplot as plt
import datetime
import numpy as np

class FuturesCurveBuilder:
    def __init__(self, market_data, config):
        self.market_data = market_data
        self.config = config
        
        self.trade_date = datetime.datetime.strptime(config['trade_date'], "%d-%m-%Y").date()
        self.convention = config['day_count_convention']
        self.freq = config['payment_frequency']
        self.interpolation_method = config['interpolation_method']
        
        self.futures_cutoff_years = config.get('futures_cutoff_years', 2.0)
        
        # T=0 always has a discount factor of 1.0
        self.discount_factors = {0.0: 1.0}

    def build_curve(self):
        self._process_cash_rates()
        self._process_futures()
        self._process_swaps()
        return self.discount_factors
    
    def _tenor_to_date(self, tenor_str):
        """Converts standard cash/swap tenors to maturity dates."""
        tenor_str = tenor_str.upper().strip()
        if tenor_str in ('O/N', 'OVERNIGHT'): 
            return self.trade_date + relativedelta(days=1)
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

    def _parse_imm_future(self, tenor_str):
        """Parses quarterly IMM future ticker (e.g., SR3M6) to start and maturity dates."""
        month_codes = {'H': 3, 'M': 6, 'U': 9, 'Z': 12}
        
        month_char = tenor_str[-2].upper()
        year_digit = int(tenor_str[-1])
        
        month = month_codes.get(month_char, 3)
        
        trade_year = self.trade_date.year
        decade = (trade_year // 10) * 10
        target_year = decade + year_digit
        
        if target_year < trade_year:
            target_year += 10
            
        imm_date = datetime.date(target_year, month, 15)
        while imm_date.weekday() != 2:  
            imm_date += datetime.timedelta(days=1)
            
        start_date = imm_date
        maturity_date = start_date + relativedelta(months=3)
        
        return start_date, maturity_date

    def _process_cash_rates(self):
        cash_data = [d for d in self.market_data if d['Instrument'] == 'Cash']
        
        for item in cash_data:
            mat_date = self._tenor_to_date(item['Tenor'])
            t = calculate_year_fraction(self.trade_date, mat_date, self.convention)
            df = 1.0 / (1.0 + (item['Quote'] / 100.0) * t)
            self.discount_factors[t] = df

    def _process_futures(self):
        futures_data = [d for d in self.market_data if d['Instrument'] == 'Future']
        
        for item in futures_data:
            start_date, mat_date = self._parse_imm_future(item['Tenor'])
            item['parsed_start_date'] = start_date
            item['parsed_mat_date'] = mat_date
            
        futures_data.sort(key=lambda x: x['parsed_start_date'])
        
        for item in futures_data:
            t_start = calculate_year_fraction(self.trade_date, item['parsed_start_date'], self.convention)
            t_end = calculate_year_fraction(self.trade_date, item['parsed_mat_date'], self.convention)
            
            # THE CUTOFF RULE: Ignores futures extending beyond the user-defined boundary
            # The +0.1 buffer accounts for IMM dates not landing exactly on perfect year fractions
            if t_end > self.futures_cutoff_years + 0.1:
                continue
            
            tau = t_end - t_start 
            implied_forward_rate = (100.0 - item['Quote']) / 100.0
            
            if t_start in self.discount_factors:
                df_start = self.discount_factors[t_start]
                df_end = df_start / (1.0 + implied_forward_rate * tau)
                self.discount_factors[t_end] = df_end
            else:
                df_start = self._get_discount_factor(t_start)
                df_end = df_start / (1.0 + implied_forward_rate * tau)
                self.discount_factors[t_end] = df_end

    def _process_swaps(self):
        swap_data = [d for d in self.market_data if d['Instrument'] == 'Swap']
        
        for item in swap_data:
            item['parsed_mat_date'] = self._tenor_to_date(item['Tenor'])
            
        swap_data.sort(key=lambda x: x['parsed_mat_date'])
        
        for item in swap_data:
            mat_date = item['parsed_mat_date']
            t_maturity = calculate_year_fraction(self.trade_date, mat_date, self.convention)
            
            # THE CUTOFF RULE: Skips overlapping swaps 
            if t_maturity <= self.futures_cutoff_years + 0.1:
                continue

            par_rate = item['Quote'] / 100.0
            
            schedule = self._generate_forward_schedule(mat_date)
            running_coupon_pv = 0.0
            prev_date = self.trade_date
            
            for current_date in schedule[:-1]:
                t_i = calculate_year_fraction(self.trade_date, current_date, self.convention)
                tau_i = calculate_year_fraction(prev_date, current_date, self.convention)
                
                df_i = self._get_discount_factor(t_i)
                
                running_coupon_pv += tau_i * df_i
                prev_date = current_date
                
            tau_n = calculate_year_fraction(prev_date, mat_date, self.convention)
            
            numerator = 1.0 - (par_rate * running_coupon_pv)
            denominator = 1.0 + (par_rate * tau_n)
            final_df = numerator / denominator
            
            self.discount_factors[t_maturity] = final_df

    def _get_discount_factor(self, t):
        """Continuous getter that applies zero-rate interpolation for missing nodes."""
        if t in self.discount_factors:
            return self.discount_factors[t]
        
        known_times = sorted(self.discount_factors.keys())
        zero_rates = [
            0.0 if t_known == 0 else -np.log(self.discount_factors[t_known]) / t_known 
            for t_known in known_times
        ]
        
        interpolated_zero = float(np.interp(t, known_times, zero_rates))
        return np.exp(-interpolated_zero * t)

    def _generate_forward_schedule(self, maturity_date):
        months_step = int(12 / self.freq)
        schedule = []
        current_date = maturity_date
        while current_date > self.trade_date:
            schedule.append(current_date)
            current_date -= relativedelta(months=months_step)
        schedule.reverse()
        return schedule
        
    def plot_curve(self, plot_type='zero_rate'):
        """Plots the yield curve using CubicSplineCurve over verified knots."""
        if not self.discount_factors:
            print("No curve data to display. Execute build_curve() first.")
            return

        # 1. Filter out t=0 to avoid the artificial origin anchor
        valid_times = [t for t in sorted(self.discount_factors.keys()) if t > 0]
        times = np.array(valid_times)
        dfs = np.array([self.discount_factors[t] for t in times])
        
        # Generate more smooth points specifically weighted towards the short end
        times_smooth = np.linspace(times.min(), times.max(), 1000)

        # Make the canvas slightly wider to accommodate the new labels
        plt.figure(figsize=(12, 6))

        # --- 2. DEFINE CUSTOM GRID POINTS (Removed 0.0) ---
        month_ticks = [i / 12.0 for i in range(1, 13)]  # 1M to 12M
        year_ticks = [2, 3, 5, 7, 10, 15, 20, 30]       # 2Y to 30Y
        custom_ticks = month_ticks + year_ticks
        
        # Create readable string labels for the axis
        custom_labels = [f"{i}M" for i in range(1, 13)] + [f"{i}Y" for i in year_ticks]

        if plot_type == 'zero_rate':
            # Simplified calculation since t=0 is no longer in the array
            rates = np.array([(-np.log(df) / t) * 100 for t, df in zip(times, dfs)])

            if len(times) >= 3:
                curve = CubicSplineCurve(times, rates)
                rates_smooth = curve.evaluate(times_smooth)
                plt.plot(times_smooth, rates_smooth, linestyle='-', color='b', label='Smoothed Spline Zero Curve')
            else:
                plt.plot(times, rates, linestyle='--', color='b', label='Linear Zero Curve')

            plt.scatter(times, rates, color='red', zorder=5, label='Bootstrapped Knots')
            plt.ylabel('Continuous Zero Rate (%)', fontsize=12)
            plt.title('Zero-Coupon Yield Curve', fontsize=14, fontweight='bold')

        elif plot_type == 'discount_factor':
            if len(times) >= 3:
                curve = CubicSplineCurve(times, dfs)
                dfs_smooth = curve.evaluate(times_smooth)
                plt.plot(times_smooth, dfs_smooth, linestyle='-', color='g', label='Smoothed Spline DF Curve')
            else:
                plt.plot(times, dfs, linestyle='--', color='g', label='Linear DF Curve')

            plt.scatter(times, dfs, color='red', zorder=5, label='Bootstrapped Knots')
            plt.ylabel('Discount Factor D(0, T)', fontsize=12)
            plt.title('Discount Factor Curve', fontsize=14, fontweight='bold')

        # --- 3. APPLY ADVANCED AXIS SCALING ---
        # Stretches the short end linearly, compresses the long end logarithmically
        plt.xscale('symlog', linthresh=1.5)
        
        # Apply our custom markers and rotate them so they do not overlap
        plt.xticks(custom_ticks, custom_labels, rotation=45, fontsize=9)
        
        plt.xlabel('Tenor', fontsize=12)
        plt.grid(True, linestyle='--', alpha=0.7)
        plt.legend()
        
        plt.tight_layout() 
        plt.show(block=True)