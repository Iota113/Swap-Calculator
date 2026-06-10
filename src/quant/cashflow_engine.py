# src/quant/cashflow_engine.py
import datetime
from collections import defaultdict
from typing import Dict, List


def merge_cashflow_schedules(schedules: List[List[dict]]) -> Dict[datetime.date, float]:
    """Sum cashflow amounts from one or more schedules by payment date."""
    merged = defaultdict(float)
    for schedule in schedules:
        for cf in schedule:
            merged[cf["date"]] += cf["amount"]
    return dict(merged)


def cashflows_to_date_map(cashflows: List[dict]) -> Dict[datetime.date, float]:
    """Convert a single leg's cashflow list into a date → amount map."""
    return merge_cashflow_schedules([cashflows])


def union_payment_dates(*date_maps: Dict[datetime.date, float]) -> List[datetime.date]:
    """Chronologically sorted union of all payment dates across maps."""
    dates = set()
    for date_map in date_maps:
        dates.update(date_map.keys())
    return sorted(dates)


def to_cumulative_timeseries(amounts_by_date: Dict[datetime.date, float]) -> List[dict]:
    """Build a simple {date, net_cashflow, cumulative} series for charting."""
    timeseries = []
    cumulative = 0.0

    for payment_date in sorted(amounts_by_date.keys()):
        amount = amounts_by_date[payment_date]
        cumulative += amount
        timeseries.append({
            "date": payment_date.strftime("%Y-%m-%d"),
            "net_cashflow": round(amount, 2),
            "cumulative": round(cumulative, 2),
        })

    return timeseries


class CashflowEngine:
    """
    Aggregates cash flows across single-currency portfolio positions.
    Delegates leg cashflow generation to SwapLeg objects and uses shared merge utilities.
    """
    def __init__(self, curve_builder):
        self.curve_builder = curve_builder
        self.trade_date = curve_builder.trade_date

    def generate_portfolio_cashflows(self, portfolio_legs: List[tuple]) -> List[dict]:
        """
        portfolio_legs: A list of tuples containing (SwapLeg, tenor_years, is_payer)
        """
        schedules = []

        for leg, tenor_years, is_payer in portfolio_legs:
            if leg.notional <= 0:
                continue

            maturity_date = self.trade_date + datetime.timedelta(days=tenor_years * 365)
            schedules.append(
                leg.generate_cashflows(self.curve_builder, self.trade_date, maturity_date, is_payer)
            )

        if not schedules:
            return []

        merged = merge_cashflow_schedules(schedules)
        return to_cumulative_timeseries(merged)
