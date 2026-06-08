import yfinance as yf

class AssetPriceOracle:
    @staticmethod
    def get_latest_price(ticker: str) -> float:
        """Fetches the most recent closing price for a given ticker."""
        stock = yf.Ticker(ticker)
        # Grab the last 1 day of data
        hist = stock.history(period="1d")
        if hist.empty:
            raise ValueError(f"Could not fetch data for ticker: {ticker}")
        return float(hist['Close'].iloc[0])

    @staticmethod
    def get_historical_price(ticker: str, date_str: str) -> float:
        """
        Fetches the closing price for a specific past date.
        date_str format: 'YYYY-MM-DD'
        """
        stock = yf.Ticker(ticker)
        # Fetch a small window around the date in case it was a weekend/holiday
        hist = stock.history(start=date_str, end=None) 
        if hist.empty:
            raise ValueError(f"No price data found for {ticker} around {date_str}")
        return float(hist['Close'].iloc[0])