# src/quant/cashflow_engine.py
import datetime
from collections import defaultdict
from typing import List

class CashflowEngine:
    """
    Core engine responsible for aggregating cash flows across multiple derivative positions.
    It delegates the calculation of individual leg cash flows to the respective SwapLeg objects
    and consolidates them into a single chronological timeseries.
    """
    def __init__(self, curve_builder):
        self.curve_builder = curve_builder
        self.trade_date = curve_builder.trade_date
        self.convention = curve_builder.convention

    def generate_portfolio_cashflows(self, portfolio_legs: List[tuple]) -> List[dict]:
        """
        portfolio_legs: A list of tuples containing (SwapLeg, tenor_years, is_payer)
        """
        master_cashflows = defaultdict(float)

        for leg, tenor_years, is_payer in portfolio_legs:
            if leg.notional <= 0:
                continue

            maturity_date = self.trade_date + datetime.timedelta(days=tenor_years * 365)
            
            # The engine no longer needs to know IF it is equity or interest rate.
            # It just asks the object for its cashflows.
            leg_cashflows = leg.generate_cashflows(self.curve_builder, self.trade_date, maturity_date, is_payer)

            for cf in leg_cashflows:
                master_cashflows[cf["date"]] += cf["amount"]

        sorted_dates = sorted(master_cashflows.keys())
        timeseries = []
        cumulative = 0.0
        
        for d in sorted_dates:
            cf = master_cashflows[d]
            cumulative += cf
            timeseries.append({
                "date": d.strftime("%Y-%m-%d"), 
                "net_cashflow": round(cf, 2),
                "cumulative": round(cumulative, 2)
            })

        return timeseries