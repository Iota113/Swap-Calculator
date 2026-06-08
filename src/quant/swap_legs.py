# src/quant/swap_legs.py
from abc import ABC, abstractmethod
import numpy as np
import datetime
from typing import List, Dict
from quant.day_counter import calculate_year_fraction, generate_forward_schedule


class SwapLeg(ABC):
    @abstractmethod
    def generate_cashflows(self, curve_builder, trade_date: datetime.date, maturity_date: datetime.date, is_payer: bool) -> List[Dict]:
        """Calculates the schedule of cash flows for this specific leg."""
        pass


class InterestRateLeg(SwapLeg):
    def __init__(self, notional: float, rate_type: str, frequency: int, fixed_rate: float = 0.0):
        self.notional = notional
        self.rate_type = rate_type.strip().lower()
        self.frequency = frequency
        self.fixed_rate = fixed_rate

    def generate_cashflows(self, curve_builder, trade_date: datetime.date, maturity_date: datetime.date, is_payer: bool) -> List[Dict]:
        schedule = generate_forward_schedule(trade_date, maturity_date, self.frequency)
        cashflows = []
        prev_date = trade_date

        for current_date in schedule:
            amount = 0.0
            tau = calculate_year_fraction(prev_date, current_date, curve_builder.convention)

            if self.rate_type == 'fixed':
                amount = self.notional * self.fixed_rate * tau

            elif self.rate_type in ['float', 'floating']:
                t_prev = calculate_year_fraction(trade_date, prev_date, curve_builder.convention)
                t_curr = calculate_year_fraction(trade_date, current_date, curve_builder.convention)
                df_prev = curve_builder._get_discount_factor(t_prev)
                df_curr = curve_builder._get_discount_factor(t_curr)
                amount = self.notional * ((df_prev / df_curr) - 1.0) if df_curr > 0 else 0.0

            else:
                raise ValueError(f"Unknown rate_type '{self.rate_type}'. Must be 'fixed' or 'float'.")

            direction = -1 if is_payer else 1
            cashflows.append({"date": current_date, "amount": amount * direction})
            prev_date = current_date

        return cashflows


class AssetReturnLeg(SwapLeg):
    def __init__(
        self,
        notional: float,
        ticker: str,
        initial_price: float,
        current_price: float,
        dividend_yield: float,
    ):
        self.notional = notional
        self.ticker = ticker
        self.initial_price = initial_price
        self.current_price = current_price
        self.dividend_yield = dividend_yield  # q in F = S * e^((r-q)*t)

    def generate_cashflows(
        self,
        curve_builder,
        trade_date: datetime.date,
        maturity_date: datetime.date,
        is_payer: bool,
    ) -> List[Dict]:
        t = calculate_year_fraction(trade_date, maturity_date, curve_builder.convention)

        if t <= 0:
            return [{"date": maturity_date, "amount": 0.0}]

        df_end = curve_builder._get_discount_factor(t)
        risk_free_rate = -np.log(df_end) / t if df_end > 0 else 0.0

        if "=" in self.ticker:
            # Commodity futures: direct price return, no carry adjustment
            price_return = (self.current_price / self.initial_price) - 1.0
        else:
            # Equity: theoretical forward price F = S * e^((r-q)*t)
            forward_price = self.current_price * np.exp((risk_free_rate - self.dividend_yield) * t)
            price_return = (forward_price / self.initial_price) - 1.0

        direction = -1 if is_payer else 1
        return [{"date": maturity_date, "amount": self.notional * price_return * direction}]