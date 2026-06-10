import numpy as np
from quant.day_counter import calculate_year_fraction


class SwapPricer:
    def __init__(self, curve_builder):
        """Initializes the pricer with an already built curve builder instance."""
        self.curve_builder = curve_builder
        self.trade_date = curve_builder.trade_date
        self.convention = curve_builder.convention

    @staticmethod
    def interpolate_discount_factor(curve_source, t: float) -> float:
        """Resolve D(t) from a curve builder or a pre-bumped discount-factor dict."""
        if isinstance(curve_source, dict):
            if t in curve_source:
                return curve_source[t]

            known_times = sorted(curve_source.keys())
            zero_rates = [
                0.0 if t_known == 0 else -np.log(curve_source[t_known]) / t_known
                for t_known in known_times
            ]
            interpolated_zero = float(np.interp(t, known_times, zero_rates))
            return np.exp(-interpolated_zero * t)

        return curve_source._get_discount_factor(t)

    @staticmethod
    def discount_cashflows(
        cashflows,
        trade_date,
        convention: str,
        curve_source,
    ) -> float:
        """NPV of undiscounted leg cashflows under a single discount curve."""
        npv = 0.0
        for cf in cashflows:
            t = calculate_year_fraction(trade_date, cf["date"], convention)
            df = SwapPricer.interpolate_discount_factor(curve_source, t)
            npv += cf["amount"] * df
        return npv

    @staticmethod
    def parallel_bumped_discount_factors(curve_builder, bp_shift: float = 0.0001) -> dict:
        """Build a +bp_shift parallel-shifted discount factor curve from bootstrapped knots."""
        bumped_dfs = {}
        for t, df in curve_builder.discount_factors.items():
            if t == 0:
                bumped_dfs[t] = 1.0
            else:
                zero_rate = -np.log(df) / t
                bumped_dfs[t] = np.exp(-(zero_rate + bp_shift) * t)
        return bumped_dfs

    def price_swap(self, paying_leg, receiving_leg, maturity_date, custom_curve=None):
        """
        Calculates the Net Present Value (NPV) of the swap by discounting
        the explicitly generated cash flows from each leg object.
        """
        curve_to_use = custom_curve if custom_curve else self.curve_builder

        pay_cfs = paying_leg.generate_cashflows(
            self.curve_builder, self.trade_date, maturity_date, is_payer=True
        )
        rec_cfs = receiving_leg.generate_cashflows(
            self.curve_builder, self.trade_date, maturity_date, is_payer=False
        )

        return self.discount_cashflows(
            pay_cfs + rec_cfs,
            self.trade_date,
            self.convention,
            curve_to_use,
        )

    def calculate_dv01(self, paying_leg, receiving_leg, maturity_date):
        """Calculates swap PVBP via a +1 bp parallel shift on zero rates."""
        base_npv = self.price_swap(paying_leg, receiving_leg, maturity_date)
        bumped_dfs = self.parallel_bumped_discount_factors(self.curve_builder)
        bumped_npv = self.price_swap(
            paying_leg, receiving_leg, maturity_date, custom_curve=bumped_dfs
        )

        return {
            "base_npv": base_npv,
            "bumped_npv": bumped_npv,
            "dv01": abs(bumped_npv - base_npv),
        }
