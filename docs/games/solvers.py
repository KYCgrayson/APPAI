"""Verify the optimal numbers in puzzle-plan.md (river crossing, night bridge, water jugs).

Run: python3 docs/games/solvers.py
"""
from collections import deque
from itertools import combinations
import heapq


def river_predators(n, cap, rowers=None):
    """n rabbits + n foxes. On a bank (and in the boat), foxes may not outnumber rabbits
    when any rabbit is present. rowers: ids allowed to row (None = everyone).
    Returns the minimum number of crossings."""
    ids = [f"rabbit{i}" for i in range(1, n + 1)] + [f"fox{i}" for i in range(1, n + 1)]
    everyone = frozenset(ids)

    def safe(group):
        r = sum(1 for x in group if x.startswith("rabbit"))
        f = len(group) - r
        return not (r > 0 and f > r)

    start = (everyone, 0)
    q, seen = deque([(start, 0)]), {start}
    while q:
        (left, side), d = q.popleft()
        if not left and side == 1:
            return d
        here = left if side == 0 else everyone - left
        for k in range(1, cap + 1):
            for boat in combinations(sorted(here), k):
                if rowers is not None and not any(x in rowers for x in boat):
                    continue
                if not safe(boat):
                    continue
                nl = left - set(boat) if side == 0 else left | set(boat)
                if not (safe(nl) and safe(everyone - nl)):
                    continue
                st = (frozenset(nl), 1 - side)
                if st not in seen:
                    seen.add(st)
                    q.append((st, d + 1))
    return None


def river_farmer():
    items = ("farmer", "wolf", "goat", "cabbage")
    bad = [{"wolf", "goat"}, {"goat", "cabbage"}]
    everyone = frozenset(items)

    def ok(bank):
        return "farmer" in bank or not any(b <= bank for b in bad)

    start = everyone
    q, seen = deque([(start, 0)]), {start}
    while q:
        left, d = q.popleft()
        if not left:
            return d
        farmer_left = "farmer" in left
        here = left if farmer_left else everyone - left
        for extra in [None] + [x for x in here if x != "farmer"]:
            boat = {"farmer"} | ({extra} if extra else set())
            nl = left - boat if farmer_left else left | boat
            if ok(nl) and ok(everyone - nl) and nl not in seen:
                seen.add(nl)
                q.append((nl, d + 1))
    return None


def bridge(times, cap=2):
    n = len(times)
    full = (1 << n) - 1
    dist = {(full, 0): 0}
    pq = [(0, full, 0)]
    while pq:
        d, left, side = heapq.heappop(pq)
        if left == 0:
            return d
        if dist.get((left, side), 1e9) < d:
            continue
        group = left if side == 0 else full ^ left
        idx = [i for i in range(n) if group >> i & 1]
        for k in range(1, cap + 1):
            for c in combinations(idx, k):
                m = sum(1 << i for i in c)
                nd = d + max(times[i] for i in c)
                st = (left ^ m, 1 - side)
                if nd < dist.get(st, 1e9):
                    dist[st] = nd
                    heapq.heappush(pq, (nd, left ^ m, 1 - side))
    return None


def jugs(caps, start, goal, allow_fill_empty):
    q, seen = deque([(tuple(start), 0)]), {tuple(start)}
    while q:
        s, d = q.popleft()
        if goal(s):
            return d
        nxt = []
        for i in range(len(caps)):
            if allow_fill_empty:
                nxt.append(s[:i] + (caps[i],) + s[i + 1:])
                nxt.append(s[:i] + (0,) + s[i + 1:])
            for j in range(len(caps)):
                if i != j:
                    m = min(s[i], caps[j] - s[j])
                    t = list(s)
                    t[i] -= m
                    t[j] += m
                    nxt.append(tuple(t))
        for t in nxt:
            if t not in seen:
                seen.add(t)
                q.append((t, d + 1))
    return None


if __name__ == "__main__":
    print("river easy (farmer)        :", river_farmer(), "(plan: 7)")
    print("river medium 3+3, boat 2   :", river_predators(3, 2), "(plan: 11)")
    print("river hard 5+5, boat 3, 2 captains:", river_predators(5, 3, {"rabbit1", "fox1"}), "(plan: 13)")
    print("  same without captain rule:", river_predators(5, 3), "(shows the rule matters: 11)")
    print("bridge 1/2/5/10            :", bridge([1, 2, 5, 10]), "(plan: 17)")
    print("bridge 1/3/6/8/12          :", bridge([1, 3, 6, 8, 12]), "(plan: 29)")
    print("bridge 1/2/4/6/8/10        :", bridge([1, 2, 4, 6, 8, 10]), "(plan: 28)")
    print("jugs 3+5 -> 4              :", jugs([3, 5], [0, 0], lambda s: 4 in s, True), "(plan: 6)")
    print("jugs 8/5/3 -> 4+4          :", jugs([8, 5, 3], [8, 0, 0], lambda s: s[0] == 4 and s[1] == 4, False), "(plan: 7)")
    print("jugs 12/7/5 -> 6+6         :", jugs([12, 7, 5], [12, 0, 0], lambda s: s[0] == 6 and s[1] == 6, False), "(plan: 11)")
