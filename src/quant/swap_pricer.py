import numpy as np
from dateutil.relativedelta import relativedelta
from quant.day_counter import calculate_year_fraction

class SwapPricer:
    def __init__(self, curve_builder):
        """
        Initializes the pricer with an already built FuturesCurveBuilder instance.
        """
        self.curve_builder = curve_builder
        self.trade_date = curve_builder.trade_date
        self.convention = curve_builder.convention

    def price_swap(self, paying_leg, receiving_leg, maturity_date, custom_curve=None):
        """
        Calculates the Net Present Value (NPV) of the swap by discounting 
        the explicitly generated cash flows from each leg object.
        """
        curve_to_use = custom_curve if custom_curve else self.curve_builder
        
        # 1. Generate the cash flows from the discrete objects
        pay_cfs = paying_leg.generate_cashflows(self.curve_builder, self.trade_date, maturity_date, is_payer=True)
        rec_cfs = receiving_leg.generate_cashflows(self.curve_builder, self.trade_date, maturity_date, is_payer=False)
        
        npv = 0.0
        
        # 2. Discount every single cash flow dynamically
        for cf in pay_cfs + rec_cfs:
            cf_date = cf["date"]
            amount = cf["amount"]
            
            t_i = calculate_year_fraction(self.trade_date, cf_date, self.convention)
            
            if isinstance(curve_to_use, dict):
                df_i = self._interpolate_dict(curve_to_use, t_i)
            else:
                df_i = curve_to_use._get_discount_factor(t_i)
            
            npv += amount * df_i

        return npv

    def calculate_dv01(self, paying_leg, receiving_leg, maturity_date):
        """
        Calculates the Swap Delta (DV01) by parallel shifting the yield curve by 1 basis point.
        """
        # 1. Calculate Base NPV
        base_npv = self.price_swap(paying_leg, receiving_leg, maturity_date)

        # 2. Create a Bumped Curve (+1 bp / 0.0001 to zero rates)
        bumped_dfs = {}
        for t, df in self.curve_builder.discount_factors.items():
            if t == 0:
                bumped_dfs[t] = 1.0
            else:
                # Calculate the original zero rate using continuous compounding
                zero_rate = -np.log(df) / t
                bumped_zero = zero_rate + 0.0001 
                bumped_dfs[t] = np.exp(-bumped_zero * t)

        # 3. Calculate Bumped NPV
        bumped_npv = self.price_swap(paying_leg, receiving_leg, maturity_date, custom_curve=bumped_dfs)

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