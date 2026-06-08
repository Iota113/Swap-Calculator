import numpy as np
from scipy.linalg import solve_banded

class CubicSplineCurve:
    def __init__(self, x, y):
        self.x = np.array(x)
        self.y = np.array(y)

        sort_indices = np.argsort(x)
        self.x = self.x[sort_indices]
        self.y = self.y[sort_indices]

        if np.any(np.diff(self.x) == 0):
            raise ValueError("xs cannot contain duplicate values.")

        self._compute_coefficients()
        

    def _compute_coefficients(self):
        h = np.diff(self.x)
        delta = np.diff(self.y) / h
        n = len(h)

        ab = np.zeros((3, n + 1))

        # main diagonal (row 1): Spans every element from 0 to n
        ab[1, 1:-1] = 2.0 * (h[:-1] + h[1:])
        ab[1, 0] = 1.0   # Boundary M_0 = 0
        ab[1, -1] = 1.0  # Boundary M_n = 0

        # upper diagonal
        ab[0, 2:] = h[1:]

        # lower diagonal
        ab[2, :-2] = h[:-1]

        B = np.zeros(n + 1)
        B[1:-1] = 6.0 * (delta[1:] - delta[:-1])

        # Solve for M
        M = solve_banded((1, 1), ab, B)

        self.a = np.diff(M) / (6.0 * h)
        self.b = M[:-1] / 2.0
        self.c = delta - (h / 6.0) * (2.0 * M[:-1] + M[1:])
        self.d = self.y[:-1]

    def evaluate(self, x_target):
        x_target = np.atleast_1d(x_target)
        
        # Vectorized interval lookup
        indices = np.searchsorted(self.x, x_target) - 1
        indices = np.clip(indices, 0, len(self.x) - 2)
        
        # Vectorized cubic evaluation
        dx = x_target - self.x[indices]
        np_y = (self.a[indices] * dx**3 + 
                     self.b[indices] * dx**2 + 
                     self.c[indices] * dx + 
                     self.d[indices])
        
        # Return a scalar if a scalar was passed, otherwise return the array
        return np_y[0] if np_y.size == 1 else np_y
