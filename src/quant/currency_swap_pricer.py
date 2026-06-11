import datetime
from typing import List, Dict, Tuple, Optional

from quant.day_counter import calculate_year_fraction
from quant.swap_legs import InterestRateLeg, generate_principal_exchange
from quant.swap_pricer import SwapPricer
from quant.cashflow_engine import cashflows_to_date_map, union_payment_dates


def fx_forward_rate(spot_fx_rate: float, df_leg1: float, df_leg2: float) -> float:
    """Covered interest parity: Leg 1 units per unit of Leg 2."""
    return spot_fx_rate * (df_leg2 / df_leg1) if df_leg1 > 0 else spot_fx_rate


class CurrencySwapPricer:
    def __init__(
        self,
        trade_date: datetime.date,
        maturity_date: datetime.date,
        spot_fx_rate: float,
        leg1_config: dict,
        leg2_config: dict,
        curve_builder1,
        curve_builder2,
        curve_builder2_basis=None,
    ):
        """
        Cross-currency swap pricer.

        spot_fx_rate: Leg 1 currency per unit of Leg 2 (e.g. USD/EUR = 1.08)
        leg1_config / leg2_config: notional, rate_type, rate_or_spread, frequency, day_count, is_payer
        """
        self.trade_date = trade_date
        self.maturity_date = maturity_date
        self.spot_fx_rate = spot_fx_rate
        self.leg1 = leg1_config
        self.leg2 = leg2_config
        self.curve1 = curve_builder1
        self.curve2 = curve_builder2
        self.curve2_basis = curve_builder2_basis or curve_builder2
        self.leg1_ir = InterestRateLeg.from_leg_config(leg1_config)
        self.leg2_ir = InterestRateLeg.from_leg_config(leg2_config)

    def _generate_interest_cashflows(self, leg_ir: InterestRateLeg, leg_config: dict, curve_builder) -> List[Dict]:
        return leg_ir.generate_cashflows(
            curve_builder,
            self.trade_date,
            self.maturity_date,
            is_payer=bool(leg_config.get("is_payer", False)),
        )

    def _value_merged_row(
        self,
        payment_date: datetime.date,
        leg1_amount: float,
        leg2_amount: float,
        curve1,
        curve2,
        spot_fx_rate: float,
        leg1_day_count: str,
        leg2_day_count: str,
        row_type: str,
    ) -> Dict:
        t_leg1 = calculate_year_fraction(self.trade_date, payment_date, leg1_day_count)
        t_leg2 = calculate_year_fraction(self.trade_date, payment_date, leg2_day_count)

        df_leg1 = SwapPricer.interpolate_discount_factor(curve1, t_leg1)
        df_leg2 = SwapPricer.interpolate_discount_factor(curve2, t_leg2)
        fx_forward = fx_forward_rate(spot_fx_rate, df_leg1, df_leg2)

        leg2_converted = leg2_amount * fx_forward
        net_cf = leg1_amount + leg2_converted
        pv_cf = net_cf * df_leg1

        return {
            "date": payment_date.strftime("%Y-%m-%d"),
            "leg1_amount": round(leg1_amount, 2),
            "leg2_amount": round(leg2_amount, 2),
            "fx_forward": round(fx_forward, 6),
            "leg2_converted": round(leg2_converted, 2),
            "net_cashflow": round(net_cf, 2),
            "df": round(df_leg1, 6),
            "pv": round(pv_cf, 2),
            "type": row_type,
            "_leg1_pv": leg1_amount * df_leg1,
            "_leg2_pv_converted": leg2_converted * df_leg1,
        }

    def price_swap(
        self,
        curve1=None,
        curve2=None,
        spot_fx_rate: Optional[float] = None,
        leg1_config: Optional[dict] = None,
        leg2_config: Optional[dict] = None,
        curve2_basis=None,
    ) -> Tuple[List[Dict], Dict]:
        """
        Price the cross-currency swap.
        Optional curve/spot/leg overrides support bump-and-revalue risk runs.
        """
        curve1 = curve1 or self.curve1
        curve2 = curve2 or self.curve2
        curve2_basis = curve2_basis or self.curve2_basis or curve2
        spot = spot_fx_rate if spot_fx_rate is not None else self.spot_fx_rate

        leg1_cfg = {**self.leg1, **(leg1_config or {})}
        leg2_cfg = {**self.leg2, **(leg2_config or {})}
        leg1_ir = InterestRateLeg.from_leg_config(leg1_cfg)
        leg2_ir = InterestRateLeg.from_leg_config(leg2_cfg)

        leg1_cfs = self._generate_interest_cashflows(leg1_ir, leg1_cfg, curve1)
        leg2_cfs = self._generate_interest_cashflows(leg2_ir, leg2_cfg, curve2)

        leg1_map = cashflows_to_date_map(leg1_cfs)
        leg2_map = cashflows_to_date_map(leg2_cfs)

        merged_schedule = []
        leg1_interest_pv = 0.0
        leg2_interest_pv_converted = 0.0

        for payment_date in union_payment_dates(leg1_map, leg2_map):
            row = self._value_merged_row(
                payment_date=payment_date,
                leg1_amount=leg1_map.get(payment_date, 0.0),
                leg2_amount=leg2_map.get(payment_date, 0.0),
                curve1=curve1,
                curve2=curve2_basis,
                spot_fx_rate=spot,
                leg1_day_count=leg1_cfg.get("day_count", "ACT/365"),
                leg2_day_count=leg2_cfg.get("day_count", "ACT/365"),
                row_type="interest",
            )
            leg1_interest_pv += row.pop("_leg1_pv")
            leg2_interest_pv_converted += row.pop("_leg2_pv_converted")
            merged_schedule.append(row)

        leg1_principal = generate_principal_exchange(
            float(leg1_cfg.get("notional", 0.0)),
            bool(leg1_cfg.get("is_payer", False)),
            self.maturity_date,
        )[0]["amount"]
        leg2_principal = generate_principal_exchange(
            float(leg2_cfg.get("notional", 0.0)),
            bool(leg2_cfg.get("is_payer", False)),
            self.maturity_date,
        )[0]["amount"]

        principal_row = self._value_merged_row(
            payment_date=self.maturity_date,
            leg1_amount=leg1_principal,
            leg2_amount=leg2_principal,
            curve1=curve1,
            curve2=curve2_basis,
            spot_fx_rate=spot,
            leg1_day_count=leg1_cfg.get("day_count", "ACT/365"),
            leg2_day_count=leg2_cfg.get("day_count", "ACT/365"),
            row_type="principal",
        )
        leg1_notional_pv = principal_row.pop("_leg1_pv")
        leg2_notional_pv_converted = principal_row.pop("_leg2_pv_converted")
        merged_schedule.append(principal_row)

        leg1_total_pv = leg1_interest_pv + leg1_notional_pv
        leg2_total_pv = leg2_interest_pv_converted + leg2_notional_pv_converted

        npv_summary = {
            "leg1_interest_pv": round(leg1_interest_pv, 2),
            "leg1_notional_pv": round(leg1_notional_pv, 2),
            "leg1_total_pv": round(leg1_total_pv, 2),
            "leg2_interest_pv": round(leg2_interest_pv_converted, 2),
            "leg2_notional_pv": round(leg2_notional_pv_converted, 2),
            "leg2_total_pv": round(leg2_total_pv, 2),
            "total_net_npv": round(leg1_total_pv + leg2_total_pv, 2),
        }

        return merged_schedule, npv_summary
