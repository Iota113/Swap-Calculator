# src/data/market_data.py
import yfinance as yf


class AssetPriceOracle:

    @staticmethod
    def get_dividend_yield(ticker: str) -> float:
        """Fetches the annualized dividend yield. Returns 0.0 for commodities/missing data."""
        stock = yf.Ticker(ticker.strip().upper())
        try:
            div_yield = stock.info.get('dividendYield', 0.0)
            return float(div_yield) if div_yield is not None else 0.0
        except Exception:
            return 0.0

    @staticmethod 
    def get_latest_price(ticker: str) -> float:
        stock = yf.Ticker(ticker.strip().upper())
        hist = stock.history(period="5d")
        if hist.empty:
            raise ValueError(f"Could not fetch live data for ticker: {ticker}")
        return float(hist['Close'].iloc[-1])  # iloc[-1] = most recent close

    @staticmethod 
    def get_historical_price(ticker: str, date_str: str) -> float:
        """
        Fetches the closing price on or after a specific date.
        Starts one day earlier to handle pre-market / market-closed scenarios.
        date_str format: 'YYYY-MM-DD'
        """
        stock = yf.Ticker(ticker.strip().upper())
        start = (datetime.date.fromisoformat(date_str) - datetime.timedelta(days=1)).isoformat()
        hist = stock.history(start=start)
        if hist.empty:
            raise ValueError(f"No price data found for {ticker} around {date_str}")
        return float(hist['Close'].iloc[0])

    @staticmethod
    def get_asset_info(ticker: str, trade_date_str: str = None) -> dict:
        """
        Aggregates spot price, current price, and dividend yield for an asset.
        trade_date_str format: 'YYYY-MM-DD' (optional; falls back to current price if omitted)
        """
        ticker_clean = ticker.strip().upper()

        current_price = AssetPriceOracle.get_latest_price(ticker_clean)
        div_yield = AssetPriceOracle.get_dividend_yield(ticker_clean)
        initial_price = (
            AssetPriceOracle.get_historical_price(ticker_clean, trade_date_str)
            if trade_date_str
            else current_price
        )

        return {
            "ticker": ticker_clean,
            "initial_price": initial_price,
            "current_price": current_price,
            "dividend_yield": div_yield,
        }