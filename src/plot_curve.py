import matplotlib.pyplot as plt
import numpy as np
from cubic_spline import CubicSplineCurve

market_maturities = np.array([0.25, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0])
market_yields = np.array([4.25, 4.50, 4.75, 4.20, 3.85, 3.90, 4.15])

curve = CubicSplineCurve(market_maturities, market_yields)

# Generate 500 points from 3 months to 20 years
x_smooth = np.linspace(0.25, 30.0, 500)
y_smooth = curve.evaluate(x_smooth)

plt.figure(figsize=(10, 6))

# Plot the actual market data points as distinct dots
plt.scatter(
    market_maturities,
    market_yields,
    color="red",
    zorder=5,
    label="Market Knots (Inputs)",
)

# Plot the continuous interpolated curve
plt.plot(
    x_smooth,
    y_smooth,
    color="blue",
    label="Natural Cubic Spline (Outputs)",
    linewidth=2,
)

# Formatting the chart
plt.title("Bootstrapped Yield Curve", fontsize=14, fontweight="bold")
plt.xlabel("Maturity (Years)", fontsize=12)
plt.ylabel("Yield (%)", fontsize=12)
plt.grid(True, linestyle="--", alpha=0.6)
plt.legend()

# Display the window
plt.show()