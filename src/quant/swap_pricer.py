import numpy as np
from dateutil.relativedelta import relativedelta
from quant.day_counter import calculate_year_fraction, generate_forward_schedule
class SwapPricer:
    def __init__(self, curve_builder):
        """
        Initializes the pricer with an already built FuturesCurveBuilder instance.
        """
        self.curve_builder = curve_builder
        self.trade_date = curve_builder.trade_date
        self.convention = curve_builder.convention

    def price_swap(self, notional, fixed_rate, maturity_date, freq, is_payer=True, custom_curve=None):
        """
        Calculates the Net Present Value (NPV) of the swap.
        Allows passing a custom_curve (dictionary of t: DF) for bumped valuations.
        """
        # Determine which curve to use (base curve or bumped curve)
        curve_to_use = custom_curve if custom_curve else self.curve_builder

        schedule = generate_forward_schedule(self.trade_date, maturity_date, freq)
        
        fixed_leg_pv = 0.0
        prev_date = self.trade_date
        
        # 1. Calculate Fixed Leg PV using the schedule
        for current_date in schedule:
            t_i = calculate_year_fraction(self.trade_date, current_date, self.convention)
            tau_i = calculate_year_fraction(prev_date, current_date, self.convention)
            
            # Support both the builder object and a raw dictionary for bumped curves
            if isinstance(curve_to_use, dict):
                # Approximation for bumped curve missing exact nodes (forces fallback to linear or nearest)
                df_i = self._interpolate_dict(curve_to_use, t_i)
            else:
                df_i = curve_to_use._get_discount_factor(t_i)
            
            fixed_leg_pv += notional * fixed_rate * tau_i * df_i
            prev_date = current_date

        # 2. Calculate Floating Leg PV
        # The PV of a standard floating leg is simply: Notional * (DF_start - DF_end)
        t_end = calculate_year_fraction(self.trade_date, maturity_date, self.convention)
        
        if isinstance(curve_to_use, dict):
            df_end = self._interpolate_dict(curve_to_use, t_end)
            df_start = 1.0 # t=0
        else:
            df_end = curve_to_use._get_discount_factor(t_end)
            df_start = curve_to_use._get_discount_factor(0.0)
            
        floating_leg_pv = notional * (df_start - df_end)

        # 3. Calculate Final NPV
        if is_payer:
            # Payer pays fixed, receives float
            npv = floating_leg_pv - fixed_leg_pv
        else:
            # Receiver receives fixed, pays float
            npv = fixed_leg_pv - floating_leg_pv

        return npv

    def calculate_dv01(self, notional, fixed_rate, maturity_date, freq, is_payer=True):
        """
        Calculates the Swap Delta (DV01) by parallel shifting the yield curve by 1 basis point.
        """
        # 1. Calculate Base NPV
        base_npv = self.price_swap(notional, fixed_rate, maturity_date, freq, is_payer)

        # 2. Create a Bumped Curve (+1 bp / 0.0001 to zero rates)
        bumped_dfs = {}
        for t, df in self.curve_builder.discount_factors.items():
            if t == 0:
                bumped_dfs[t] = 1.0
            else:
                zero_rate = -np.log(df) / t
                bumped_zero = zero_rate + 0.0001 
                bumped_dfs[t] = np.exp(-bumped_zero * t)

        # 3. Calculate Bumped NPV
        bumped_npv = self.price_swap(notional, fixed_rate, maturity_date, freq, is_payer, custom_curve=bumped_dfs)

        # DV01 is the absolute change in value
        dv01 = abs(bumped_npv - base_npv)
        
        return {
            "base_npv": base_npv,
            "bumped_npv": bumped_npv,
            "dv01": dv01
        }

    def _interpolate_dict(self, curve_dict, t):
        """Helper to interpolate DFs from a raw dictionary (used for the bumped curve)."""
        if t in curve_dict:
            return curve_dict[t]
        
        known_times = sorted(curve_dict.keys())
        zero_rates = [
            0.0 if t_known == 0 else -np.log(curve_dict[t_known]) / t_known 
            for t_known in known_times
        ]
        interpolated_zero = float(np.interp(t, known_times, zero_rates))
        return np.exp(-interpolated_zero * t)