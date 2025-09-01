from dataclasses import dataclass

@dataclass
class IRShock:
    name: str
    parallel_bps: int = 0  # +200 means +2.00%

PARALLEL_UP_200 = IRShock("Parallel +200bps", parallel_bps=200)
PARALLEL_DOWN_200 = IRShock("Parallel -200bps", parallel_bps=-200)