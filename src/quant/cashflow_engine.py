# src/quant/cashflow_engine.py
import datetime
from collections import defaultdict
from quant.day_counter import calculate_year_fraction, generate_forward_schedule

class CashflowEngine:
    def __init__(self, curve_builder):
        self.curve_builder = curve_builder
        self.trade_date = curve_builder.trade_date
        self.convention = curve_builder.convention

    def generate_portfolio_cashflows(self, portfolio_data):
        master_cashflows = defaultdict(float)

        for pos in portfolio_data:
            notional = float(pos.get('notional', 0))
            if notional <= 0:
                continue
            
            fixed_rate = float(pos.get('fixed_rate', 0)) / 100.0
            tenor_years = int(pos.get('tenor_years', 0))
            freq = int(pos.get('frequency', 2)) # Now pulls from the individual position
            is_payer = True if pos.get('position') == 'payer' else False

            maturity_date = self.trade_date + datetime.timedelta(days=tenor_years * 365)
            schedule = generate_forward_schedule(self.trade_date, maturity_date, freq)

            prev_date = self.trade_date
            
            for current_date in schedule:
                t_prev = calculate_year_fraction(self.trade_date, prev_date, self.convention)
                t_curr = calculate_year_fraction(self.trade_date, current_date, self.convention)
                tau = calculate_year_fraction(prev_date, current_date, self.convention)

                df_prev = self.curve_builder._get_discount_factor(t_prev)
                df_curr = self.curve_builder._get_discount_factor(t_curr)

                fixed_cf = notional * fixed_rate * tau
                float_cf = notional * ((df_prev / df_curr) - 1.0) if df_curr > 0 else 0.0

                if is_payer:
                    net_cf = float_cf - fixed_cf
                else:
                    net_cf = fixed_cf - float_cf

                master_cashflows[current_date] += net_cf
                prev_date = current_date

        sorted_dates = sorted(master_cashflows.keys())
        timeseries = []
        cumulative = 0.0
        
        for d in sorted_dates:
            cf = master_cashflows[d]
            cumulative += cf
            timeseries.append({
                "date": d.strftime("%Y-%m-%d"), # ISO format for easy JS sorting
                "net_cashflow": round(cf, 2),
                "cumulative": round(cumulative, 2)
            })

        return timeseries