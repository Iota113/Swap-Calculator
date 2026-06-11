import copy
from typing import Dict, List, Optional, Type

import numpy as np

from quant.futures_curve_builder import FuturesCurveBuilder

BP_SHIFT = 0.0001
FX_SHIFT_PCT = 0.01


def parallel_bumped_discount_factors(curve_builder, bp_shift: float = BP_SHIFT) -> dict:
    """Parallel +bp_shift shift on continuous zero rates at bootstrapped knots."""
    bumped_dfs = {}
    for t, df in curve_builder.discount_factors.items():
        if t == 0:
            bumped_dfs[t] = 1.0
        else:
            zero_rate = -np.log(df) / t
            bumped_dfs[t] = np.exp(-(zero_rate + bp_shift) * t)
    return bumped_dfs


def apply_quote_bump(record: dict, bp_shift: float = BP_SHIFT) -> float:
    """Bump a market quote by +1 bp (RATE quotes up; futures PRICE quotes down)."""
    quote = float(record["Quote"])
    quote_type = str(record.get("QuoteType", "RATE")).upper()
    bump_pct_pts = bp_shift * 100.0
    if quote_type == "RATE":
        return quote + bump_pct_pts
    return quote - bump_pct_pts


def bump_market_data_parallel(market_data: List[dict], bp_shift: float = BP_SHIFT) -> List[dict]:
    bumped = copy.deepcopy(market_data)
    for rec in bumped:
        if rec.get("skipped"):
            continue
        rec["Quote"] = apply_quote_bump(rec, bp_shift)
    return bumped


def bump_market_data_pillar(
    market_data: List[dict],
    pillar_index: int,
    bp_shift: float = BP_SHIFT,
) -> List[dict]:
    bumped = copy.deepcopy(market_data)
    rec = bumped[pillar_index]
    if not rec.get("skipped"):
        rec["Quote"] = apply_quote_bump(rec, bp_shift)
    return bumped


def rebuild_curve(
    market_data: List[dict],
    config: dict,
    builder_class: Type = FuturesCurveBuilder,
):
    builder = builder_class(market_data=market_data, config=config)
    builder.build_curve()
    return builder


def _is_floating_leg(leg_config: dict) -> bool:
    return leg_config.get("rate_type", "fixed").strip().lower() in ("float", "floating")


def _spread_bump_config(leg_config: dict, bp_shift: float = BP_SHIFT) -> dict:
    bumped = {**leg_config}
    bumped["rate_or_spread"] = float(leg_config.get("rate_or_spread", 0.0)) + bp_shift * 100.0
    return bumped


def _pillar_delta_vector(
    pricer,
    base_npv: float,
    market_data: List[dict],
    config: dict,
    leg_key: str,
    bp_shift: float,
) -> List[dict]:
    deltas = []
    for idx, record in enumerate(market_data):
        if record.get("skipped"):
            continue

        bumped_data = bump_market_data_pillar(market_data, idx, bp_shift)
        bumped_builder = rebuild_curve(bumped_data, config)

        price_kwargs = {"curve1": bumped_builder} if leg_key == "1" else {"curve2": bumped_builder}
        _, summary = pricer.price_swap(**price_kwargs)
        delta = summary["total_net_npv"] - base_npv

        entry = {
            "pillar_index": idx,
            "instrument": record["Instrument"],
            "tenor": record["Tenor"],
            "quote": record["Quote"],
            "quote_type": record.get("QuoteType", "RATE"),
            "delta": round(delta, 2),
            "pvbp": round(abs(delta), 2),
        }
        deltas.append(entry)

    return deltas


class RiskEngine:
    @staticmethod
    def calculate_swap_dv01(
        swap_pricer,
        paying_leg,
        receiving_leg,
        maturity_date,
        bp_shift: float = BP_SHIFT,
    ) -> Dict[str, float]:
        """Single-currency parallel PVBP via zero-rate bump on discount factors."""
        base_npv = swap_pricer.price_swap(paying_leg, receiving_leg, maturity_date)
        bumped_dfs = parallel_bumped_discount_factors(swap_pricer.curve_builder, bp_shift)
        bumped_npv = swap_pricer.price_swap(
            paying_leg, receiving_leg, maturity_date, custom_curve=bumped_dfs
        )
        return {
            "base_npv": base_npv,
            "bumped_npv": bumped_npv,
            "dv01": abs(bumped_npv - base_npv),
        }

    @staticmethod
    def calculate_ccs_risk(
        pricer,
        active_market_data1: List[dict],
        active_market_data2: List[dict],
        config1: dict,
        config2: dict,
        bp_shift: float = BP_SHIFT,
        fx_shift_pct: float = FX_SHIFT_PCT,
    ) -> Dict:
        """
        Cross-currency swap sensitivities:
          - parallel DV01 per curve
          - per-pillar delta vectors per curve
          - FX delta (NPV change per +fx_shift_pct spot move)
          - basis spread PVBP per floating leg
        """
        _, base_summary = pricer.price_swap()
        base_npv = base_summary["total_net_npv"]

        bumped_builder1 = rebuild_curve(
            bump_market_data_parallel(active_market_data1, bp_shift), config1
        )
        _, leg1_parallel_summary = pricer.price_swap(curve1=bumped_builder1)
        leg1_parallel_delta = leg1_parallel_summary["total_net_npv"] - base_npv

        bumped_builder2 = rebuild_curve(
            bump_market_data_parallel(active_market_data2, bp_shift), config2
        )
        _, leg2_parallel_summary = pricer.price_swap(curve2=bumped_builder2)
        leg2_parallel_delta = leg2_parallel_summary["total_net_npv"] - base_npv

        bumped_spot = pricer.spot_fx_rate * (1.0 + fx_shift_pct)
        _, fx_summary = pricer.price_swap(spot_fx_rate=bumped_spot)
        fx_delta = fx_summary["total_net_npv"] - base_npv

        leg1_spread = None
        if _is_floating_leg(pricer.leg1):
            _, spread_summary = pricer.price_swap(
                leg1_config=_spread_bump_config(pricer.leg1, bp_shift)
            )
            leg1_spread = {
                "delta": round(spread_summary["total_net_npv"] - base_npv, 2),
                "pvbp": round(abs(spread_summary["total_net_npv"] - base_npv), 2),
            }

        leg2_spread = None
        if _is_floating_leg(pricer.leg2):
            _, spread_summary = pricer.price_swap(
                leg2_config=_spread_bump_config(pricer.leg2, bp_shift)
            )
            leg2_spread = {
                "delta": round(spread_summary["total_net_npv"] - base_npv, 2),
                "pvbp": round(abs(spread_summary["total_net_npv"] - base_npv), 2),
            }

        return {
            "base_npv": round(base_npv, 2),
            "parallel": {
                "leg1_dv01": round(abs(leg1_parallel_delta), 2),
                "leg1_delta": round(leg1_parallel_delta, 2),
                "leg2_dv01": round(abs(leg2_parallel_delta), 2),
                "leg2_delta": round(leg2_parallel_delta, 2),
                "fx_delta_1pct": round(fx_delta, 2),
                "fx_shift_pct": fx_shift_pct,
                "leg1_spread_pvbp": leg1_spread["pvbp"] if leg1_spread else None,
                "leg2_spread_pvbp": leg2_spread["pvbp"] if leg2_spread else None,
            },
            "leg1_spread": leg1_spread,
            "leg2_spread": leg2_spread,
            "leg1_delta_vector": _pillar_delta_vector(
                pricer, base_npv, active_market_data1, config1, "1", bp_shift
            ),
            "leg2_delta_vector": _pillar_delta_vector(
                pricer, base_npv, active_market_data2, config2, "2", bp_shift
            ),
            "method": {
                "rate_bump": "+1 bp on market quotes (parallel or per pillar)",
                "fx_bump": f"+{fx_shift_pct * 100:.0f}% relative spot shift",
                "spread_bump": "+1 bp on floating leg spread (percent points)",
            },
        }
