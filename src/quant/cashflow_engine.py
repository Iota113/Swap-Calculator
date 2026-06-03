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
                # 1. Calculate the time fractions (The missing lines!)
                t_prev = calculate_year_fraction(self.trade_date, prev_date, self.convention)
                t_curr = calculate_year_fraction(self.trade_date, current_date, self.convention)
                tau = calculate_year_fraction(prev_date, current_date, self.convention)

                # 2. Grab the discount factors using the newly defined time fractions
                df_prev = self.curve_builder._get_discount_factor(t_prev)
                df_curr = self.curve_builder._get_discount_factor(t_curr)

                # 3. Standard Implied Floating Cashflow
                float_cf = notional * ((df_prev / df_curr) - 1.0) if df_curr > 0 else 0.0

                # 4. Check if user typed SOFR/FLOAT (Basis Swap) or a Standard Fixed Rate
                rate_type = pos.get('rate_type', 'fixed')
                
                if rate_type == 'floating':
                    # Leg 1 is Float + Spread. Leg 2 is pure Float.
                    spread_cf = notional * fixed_rate * tau
                    custom_leg_cf = float_cf + spread_cf
                    
                    if is_payer:
                        net_cf = float_cf - custom_leg_cf # Receive pure Float, Pay Float + Spread
                    else:
                        net_cf = custom_leg_cf - float_cf # Receive Float + Spread, Pay pure Float
                else:
                    # Standard Fixed vs Float
                    fixed_cf = notional * fixed_rate * tau
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