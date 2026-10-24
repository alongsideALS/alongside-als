"""d3-geo's geoAlbersUsa, ported: scale 1300, translate [487.5, 305] (the us-atlas *-albers-10m frame, 975x610)."""
import math

def conic_equal_area(y0, y1):
    sy0 = math.sin(y0); n = (sy0 + math.sin(y1)) / 2
    if abs(n) < 1e-12:
        raise ValueError("cylindrical")
    c = 1 + sy0 * (2 * n - sy0); r0 = math.sqrt(c) / n
    def raw(x, y):
        r = math.sqrt(max(c - 2 * n * math.sin(y), 0)) / n
        return (r * math.sin(x * n), r0 - r * math.cos(x * n))
    return raw

RAD = math.pi / 180

class Conic:
    def __init__(self, parallels, rotate_lambda, center, k, translate):
        self.raw = conic_equal_area(parallels[0] * RAD, parallels[1] * RAD)
        self.dl = rotate_lambda * RAD
        self.k = k
        cx, cy = self.raw(center[0] * RAD, center[1] * RAD)
        self.tx = translate[0] - cx * k
        self.ty = translate[1] + cy * k
        self.clip = None
    def project(self, lon, lat):
        lam = lon * RAD + self.dl
        # wrap to [-pi, pi]
        lam = (lam + math.pi) % (2 * math.pi) - math.pi
        x, y = self.raw(lam, lat * RAD)
        px, py = self.tx + x * self.k, self.ty - y * self.k
        if self.clip:
            (x0, y0), (x1, y1) = self.clip
            if not (x0 <= px <= x1 and y0 <= py <= y1):
                return None
        return (px, py)

def albers_usa(k=1300.0, x=487.5, y=305.0):
    e = 1e-6
    lower48 = Conic([29.5, 45.5], 96, [-0.6, 38.7], k, [x, y])
    lower48.clip = ((x - 0.455 * k, y - 0.238 * k), (x + 0.455 * k, y + 0.238 * k))
    alaska = Conic([55, 65], 154, [-2, 58.5], k * 0.35, [x - 0.307 * k, y + 0.201 * k])
    alaska.clip = ((x - 0.425 * k + e, y + 0.120 * k + e), (x - 0.214 * k - e, y + 0.234 * k - e))
    hawaii = Conic([8, 18], 157, [-3, 19.9], k, [x - 0.205 * k, y + 0.212 * k])
    hawaii.clip = ((x - 0.214 * k + e, y + 0.166 * k + e), (x - 0.115 * k - e, y + 0.234 * k - e))
    def project(lon, lat):
        for p in (lower48, alaska, hawaii):
            r = p.project(lon, lat)
            if r: return r
        return None
    return project

PROJECT = albers_usa()

if __name__ == "__main__":
    for name, lon, lat in [("Washington DC", -77.0369, 38.9072), ("Los Angeles", -118.2437, 34.0522), ("Anchorage", -149.9003, 61.2181), ("Honolulu", -157.8583, 21.3069), ("Miami", -80.1918, 25.7617), ("Seattle", -122.3321, 47.6062)]:
        print(name, PROJECT(lon, lat))
