from __future__ import annotations

from typing import List, Dict
import time
import urllib.parse


def _now_iso(offset_hours: int = 0) -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%S", time.gmtime(time.time() - offset_hours * 3600))


def get_company_news_mock(name: str, limit: int = 5) -> List[Dict[str, object]]:
    """Return deterministic mock news items similar to the frontend `news.js` generator.

    Produces items with keys: title, url, source, published_at, summary, stored, person_name, risk, confidence
    """
    if not name:
        name = "目标"
    # decide if this looks like a person (simple heuristic: starts with 'P' or contains CJK)
    is_person = False
    if str(name).upper().startswith("P") or any("\u4e00" <= c <= "\u9fff" for c in str(name)):
        is_person = True

    sources = ["财新网", "澎湃新闻", "界面新闻", "证券时报", "新京报"]

    if is_person:
        base = [
            {
                "title": "成都宏远贸易有限公司2024远景规划",
                "url": "#",
                "source": sources[0],
                "published_at": _now_iso(0),
                "summary": "李辉近期在多次公开场合提及其对成都宏远贸易有限公司未来发展的规划，强调创新与市场拓展的重要性。",
                "stored": True,
            },
            {
                "title": "成都宏远贸易李辉总经理春节致辞",
                "url": "#",
                "source": sources[1],
                "published_at": _now_iso(1),
                "summary": "在新春佳节来临之际，李辉总经理发表致辞，感谢员工的辛勤付出，并展望公司在新的一年的发展方向。",
                "stored": False,
            },
            {
                "title": "成都宏远贸易有限公司李辉出席行业峰会",
                "url": "#",
                "source": sources[2],
                "published_at": _now_iso(24),
                "summary": "李辉在行业峰会上分享了成都宏远贸易有限公司的最新发展成果和未来战略规划，获得广泛关注。",
                "stored": True,
            },
        ]
    else:
        base = [
            {
                "title": f"{name} 关联企业信息披露引关注",
                "url": "#",
                "source": sources[0],
                "published_at": _now_iso(0),
                "summary": f"{name} 与关联公司的股权和任职信息被媒体整理，部分细节以工商登记与企业披露为准。",
                "stored": True,
            },
            {
                "title": f"媒体：{name} 关联企业被列入核查范围",
                "url": "#",
                "source": sources[1],
                "published_at": _now_iso(1),
                "summary": f"多家媒体报道关注 {name} 相关主体的经营与信息披露情况，正在进一步核实相关公告与公开记录。",
                "stored": False,
            },
            {
                "title": f"{name} 出任多家企业管理职务",
                "url": "#",
                "source": sources[2],
                "published_at": _now_iso(24),
                "summary": f"公开资料显示 {name} 在若干企业担任高管或法定代表人，具体履历以企业年报与工商信息为准。",
                "stored": True,
            },
        ]

    out: List[Dict[str, object]] = []
    for i in range(limit):
        item = dict(base[i % len(base)])
        # make title unique per index
        if i > 0:
            item["title"] = item["title"] + f" （#{i + 1})"
        # set a URL that looks like a search link
        item["url"] = f"https://example.com/search?q={urllib.parse.quote_plus(str(name))}&item={i+1}"
        item["published_at"] = _now_iso(i)
        item["person_name"] = str(name)
        # deterministic pseudo-risk/confidence
        h = sum(ord(c) for c in (str(name) + str(i))) % 100 or 42
        if any(k in item.get("summary", "") for k in ["政府", "国有", "任职"]):
            item["risk"] = "High"
            item["confidence"] = 80 + (h % 20)
        else:
            levels = ["Low", "Medium", "High"]
            item["confidence"] = 60 + (h % 41)
            item["risk"] = levels[h % len(levels)]
        out.append(item)
    return out
