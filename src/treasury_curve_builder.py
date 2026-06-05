from quant.day_counter import calculate_year_fraction
from dateutil.relativedelta import relativedelta
import datetime
import numpy as np

class TreasuryCurveBuilder:
    def __init__(self, market_data, config):
        self.market_data = market_data
        self.config = config
        
        self.trade_date = datetime.datetime.strptime(config['trade_date'], "%d-%m-%Y").date()
        self.convention = config['day_count_convention']
        self.freq = config.get('payment_frequency', 2) # Treasuries pay semi-annually by default
        
        # T=0 always has a discount factor of 1.0
        self.discount_factors = {0.0: 1.0}

    def build_curve(self):
        self._process_bills()
        self._process_notes_bonds()
        return self.discount_factors

    def _tenor_to_date(self, tenor_str):
        """Converts standard treasury tenors (e.g., '3M', '2Y') to maturity dates."""
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

    def _process_bills(self):
        """Processes T-Bills (zero-coupon bonds). Quoted as price (out of 100 par)."""
        bills_data = [d for d in self.market_data if d['Instrument'].lower() == 'bill']
        
        for item in bills_data:
            mat_date = self._tenor_to_date(item['Tenor'])
            t = calculate_year_fraction(self.trade_date, mat_date, self.convention)
            
            # Since T-Bills are zero-coupon, the discount factor is simply Price / 100.0
            price = float(item['Price'])
            df = price / 100.0
            self.discount_factors[t] = df

    def _process_notes_bonds(self):
        """Processes Notes and Bonds (coupon-bearing, paying semi-annual coupons)."""
        bonds_data = [d for d in self.market_data if d['Instrument'].lower() in ['note', 'bond']]
        
        # Sort notes and bonds by maturity to bootstrap sequentially
        for item in bonds_data:
            item['parsed_mat_date'] = self._tenor_to_date(item['Tenor'])
            
        bonds_data.sort(key=lambda x: x['parsed_mat_date'])
        
        for item in bonds_data:
            mat_date = item['parsed_mat_date']
            t_maturity = calculate_year_fraction(self.trade_date, mat_date, self.convention)
            
            coupon_rate = float(item.get('Coupon', 0.0)) / 100.0
            price = float(item['Price']) / 100.0
            
            # Coupon payment per period (semi-annual is default)
            coupon_payment = coupon_rate / self.freq
            
            # Generate coupon dates schedule going back from maturity
            schedule = self._generate_coupon_schedule(mat_date)
            
            running_coupon_pv = 0.0
            
            # Sum the present value of all intermediate coupons
            for coupon_date in schedule[:-1]:
                t_i = calculate_year_fraction(self.trade_date, coupon_date, self.convention)
                df_i = self._get_discount_factor(t_i)
                running_coupon_pv += coupon_payment * df_i
                
            # Bootstrap final discount factor at maturity
            # P = coupon * sum(df_i) + (1 + coupon) * df_maturity
            numerator = price - running_coupon_pv
            denominator = 1.0 + coupon_payment
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

    def _generate_coupon_schedule(self, maturity_date):
        """Generates payment dates going back in 6-month steps until trade date."""
        months_step = int(12 / self.freq)
        schedule = []
        current_date = maturity_date
        while current_date > self.trade_date:
            schedule.append(current_date)
            current_date -= relativedelta(months=months_step)
        schedule.reverse()
        return schedule
