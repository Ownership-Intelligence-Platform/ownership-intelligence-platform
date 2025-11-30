from typing import List, Dict, Optional
import random
from datetime import datetime, timedelta


def _mask_id(id_raw: str) -> str:
    # return a partially masked ID (keep last 4 chars)
    if not id_raw:
        id_raw = "".join(str(random.randint(0, 9)) for _ in range(18))
    return id_raw[:-4].replace(id_raw[:-4], '***') + id_raw[-4:]


def _fake_phone() -> str:
    return f"1{random.randint(30, 89)}{random.randint(1000,9999):04d}{random.randint(1000,9999):04d}"[:11]


def _fake_address() -> str:
    provinces = ["北京市", "上海市", "广东省", "江苏省", "陕西省", "浙江省"]
    cities = ["朝阳区", "浦东新区", "天河区", "西安市", "杭州市", "南京市"]
    return f"{random.choice(provinces)}{random.choice(cities)}{random.randint(1,200)}号"


def _pct() -> str:
    return f"{random.randint(1,99)}%"


def _litigation_flag() -> str:
    flags = [
        "无公开诉讼记录",
        "涉及民事诉讼，多起执行信息",
        "曾被列为失信被执行人（已移出/在列）",
        "行政处罚记录（税务/工商）",
        "涉金融/外汇调查线索（待核实）",
    ]
    return random.choice(flags)


def _make_snippet(provider: str, name: str, for_company: bool = False) -> str:
    # Five template types to add variety and risk signals
    t = random.randint(1, 5)
    phone = _fake_phone()
    addr = _fake_address()
    id_mask = _mask_id(str(random.randint(10 ** 17, 10 ** 18 - 1)))
    pub_date = (datetime.utcnow() - timedelta(days=random.randint(0, 365))).strftime("%Y-%m-%d")

    if for_company:
        regno = _mask_id(str(random.randint(10 ** 9, 10 ** 10 - 1)))
        capital = f"{random.randint(50, 5000)} 万元"
        biz = random.choice(["贸易、技术服务", "信息技术、软件开发", "餐饮服务", "进出口业务", "制造业"])
        shareholders = ", ".join([f"股东{j+1}（持股{_pct()}）" for j in range(random.randint(1, 3))])
        directors = ", ".join([f"董监高{j+1}" for j in range(random.randint(1, 4))])
        changes = random.choice(["近两年有股权变更", "股权结构稳定", "频繁股权迁移（需关注）"])

        if t == 1:
            return f"{provider}公开记录（{pub_date}）：公司名：{name}；注册号：{regno}（脱敏）；注册资本：{capital}；注册地址：{addr}；经营范围：{biz}。法定代表人/主要负责人信息见其公司档案。"
        if t == 2:
            return f"{provider}资料显示：{name} 的股东构成：{shareholders}；董监高：{directors}；近年年报披露经营情况有限，{changes}。{_litigation_flag()}。"
        if t == 3:
            return f"{provider}检索：{name} 近一年内被报道存在供应链往来与非标准票据争议，涉款方/金额部分披露，建议进一步核实。联系方式（可能）：{phone}，地址线索：{addr}。"
        if t == 4:
            return f"{provider}企业信息：{name} 于{pub_date}有公开工商变更记录，{changes}；部分公开文件显示关联客户/关联交易，但披露不完整，需补充财务与合同凭证。"
        return f"{provider}档案：{name} 的历史记录包括：经营异常/行政处罚/司法协查等条目（若无则标注无），建议对关键高管与大额交易做身份与来源验证。"

    # person templates
    gender = random.choice(["男", "女"]) if len(name) <= 4 else random.choice(["男", "女"])
    age = random.randint(28, 65)
    related_company = f"{name} 关联企业{random.randint(1,3)}"
    pct = _pct()

    if t == 1:
        return f"{provider}公开档案（{pub_date}）：姓名：{name}；性别：{gender}；年龄：{age}；身份证（脱敏）：{id_mask}；联系方式：{phone}；居住地线索：{addr}。公开资料显示曾在多家企业任高管/实控人。"
    if t == 2:
        return f"{provider}检索到{pub_date}的记录：{name} 曾任 {related_company} 高管（持股约{pct}），涉及对外担保/关联交易记录，可能存在利益穿透风险。{_litigation_flag()}。"
    if t == 3:
        return f"{provider}媒体/档案显示：{name} 的社交与招聘档案、对外合同摘录可见过去与若干企业存在业务往来（金额未披露），联系方式线索：{phone}。建议核验银行流水或合同。"
    if t == 4:
        return f"{provider}记录（摘要）：{name} 被检索到的司法/行政记录摘要：{_litigation_flag()}；如涉及执行或限制高消费，请在尽职调查中重点核查。"
    return f"{provider}检索：{name} 的公开信息包含基本身份与职业线索（身份证、住址、职务、关联企业等），并有少量负面或媒体报道，需进一步采集证据以供合规分析。"


def _is_company(name: str) -> bool:
    if not name:
        return False
    company_keywords = ["公司", "企业", "有限公司", "集团", "关联企业"]
    if any(k in name for k in company_keywords):
        return True
    # heuristics: names longer than 4 chars and containing spaces/punctuation likely companies
    if len(name) > 4:
        return True
    return False


def _fake_person_name() -> str:
    surnames = ["王", "李", "张", "刘", "陈", "杨", "赵", "黄", "周", "吴"]
    given = ["强", "伟", "敏", "静", "磊", "芳", "婷", "刚", "军", "丽"]
    return random.choice(surnames) + random.choice(given)


def _derive_risk(snippet: str) -> tuple[List[str], float]:
    """Simple heuristic: detect keywords and return risk tags and a 0-1 risk score."""
    tags = []
    score = 0.0
    s = (snippet or "").lower()
    # keyword -> (tag, weight)
    kws = [
        ("失信", "dishonest", 0.6),
        ("执行", "enforcement", 0.5),
        ("行政处罚", "administrative_penalty", 0.5),
        ("司法", "judicial", 0.5),
        ("涉金融", "financial", 0.6),
        ("涉外汇", "foreign_exchange", 0.6),
        ("争议", "dispute", 0.4),
        ("担保", "guarantee", 0.3),
        ("经营异常", "abnormal_business", 0.4),
        ("负面", "negative_media", 0.35),
    ]
    for kw, tag, w in kws:
        if kw in snippet:
            tags.append(tag)
            score += w

    # small random baseline
    score += random.uniform(0.0, 0.15)
    # normalize to 0..1
    score = max(0.0, min(1.0, score))
    return tags, round(score, 3)


def _score_from_name(query_name: str, candidate_name: str) -> float:
    if not query_name:
        return random.uniform(0.2, 0.6)
    q = query_name.replace(" ", "").lower()
    c = candidate_name.replace(" ", "").lower()
    if q == c:
        return 0.95
    if q in c or c in q:
        return 0.8 + random.uniform(-0.05, 0.05)
    # partial token overlap
    qtokens = set([t for t in q.split() if t])
    ctokens = set([t for t in c.split() if t])
    if qtokens & ctokens:
        return 0.6 + random.uniform(-0.1, 0.1)
    return random.uniform(0.25, 0.55)


def mcp_search(
    query: str,
    parsed: Optional[Dict] = None,
    sources: Optional[List[str]] = None,
    top_k: int = 5,
) -> List[Dict]:
    """
    Mock MCP search across configured external sources.

    Returns a list of dicts: {source, id, name, snippet, url, match_score}
    """
    q = (query or "").strip()
    parsed_name = None
    addr_kw = []
    try:
        if parsed and isinstance(parsed, dict):
            parsed_name = parsed.get("name")
            addr_kw = parsed.get("address_keywords") or []
    except Exception:
        parsed_name = None

    # List of mock providers (order does not imply priority)
    providers = ["企查查", "天眼查", "国家企业信用公示", "网盘/归档", "新闻"]
    if sources:
        # allow front-end to restrict sources
        providers = [s for s in providers if s in sources]
    results = []

    # Create a few synthetic candidate hits using parsed name and small variations
    base_candidates = []
    if parsed_name:
        base_candidates.append(parsed_name)
        base_candidates.append(parsed_name + " (陕西)")
        base_candidates.append("李" + parsed_name[-2:])
    # also include tokens from query
    tokens = [t.strip() for t in q.replace("，", " ").split() if t.strip()]
    for t in tokens[:2]:
        if t and t not in base_candidates:
            base_candidates.append(t)

    if not base_candidates:
        base_candidates = [q or "结果1", "结果2"]

    # provider display names and logo hints (served from static/images/providers)
    provider_display = {
        "qichacha": "企查查",
        "tianyancha": "天眼查",
        "gsxt": "国家企业信用公示",
        "wangpan": "网盘/归档",
        "news": "新闻",
    }
    provider_logo = {
        "qichacha": "/static/images/providers/qichacha.svg",
        "tianyancha": "/static/images/providers/tianyancha.svg",
        "gsxt": "/static/images/providers/gsxt.svg",
        "wangpan": "/static/images/providers/wangpan.svg",
        "news": "/static/images/providers/news.svg",
    }

    # build mock results
    for i, cand in enumerate(base_candidates):
        provider = providers[i % len(providers)]
        name = cand
        snippet = _make_snippet(provider, name, for_company=_is_company(name))
        score = _score_from_name(parsed_name or q, name)
        # basic person attributes (populate for both person and company results)
        if _is_company(name):
            person_name = _fake_person_name()
        else:
            person_name = name
        gender = random.choice(["男", "女"]) if person_name else ""
        age = random.randint(25, 75)

        # derive risk tags and numeric score from snippet text
        risk_tags, risk_score = _derive_risk(snippet)
        # provide an adjusted match score reflecting risk (informational)
        match_score_adjusted = round(min(1.0, score * (1 - 0.15 * risk_score)), 3)
        # boost if address keyword appears
        if addr_kw:
            for k in addr_kw:
                if k and k in snippet:
                    score = min(1.0, score + 0.08)
        # add additional contextual fields: provider display name, logo, pub_date and mock companies
        pub_date = (datetime.utcnow() - timedelta(days=random.randint(0, 365))).strftime("%Y-%m-%d")
        companies = []
        if provider in ("qichacha", "tianyancha", "gsxt"):
            # mock associated companies for registry providers
            companies = [f"{name} 的关联企业 {j+1}" for j in range(random.randint(0, 3))]

        results.append(
            {
                "source": provider,
                "provider_display": provider_display.get(provider, provider),
                "provider_logo": provider_logo.get(provider, "/static/images/providers/default.svg"),
                "id": f"{provider}-{i+1}",
                "name": name,
                "title": name,
                "snippet": snippet,
                "person_name": person_name,
                "gender": gender,
                "age": age,
                "risk_tags": risk_tags,
                "risk_score": risk_score,
                "match_score_adjusted": match_score_adjusted,
                "url": f"https://mock.{provider}.example/{i+1}",
                "match_score": round(score, 3),
                "score": round(score, 3),
                "pub_date": pub_date,
                "companies": companies,
            }
        )

    # add some random additional seeds
    while len(results) < min(top_k, 6):
        i = len(results) + 1
        p = random.choice(providers)
        name = f"候选 {i} ({p})"
        # add same richer shape for additional seeds
        pub_date = (datetime.utcnow() - timedelta(days=random.randint(0, 365))).strftime("%Y-%m-%d")
        snippet = _make_snippet(p, name, for_company=_is_company(name))
        score = round(random.uniform(0.25, 0.6), 3)
        # basic person attributes for seed
        person_name = _fake_person_name() if _is_company(name) else name
        gender = random.choice(["男", "女"]) if person_name else ""
        age = random.randint(25, 75)
        risk_tags, risk_score = _derive_risk(snippet)
        match_score_adjusted = round(min(1.0, score * (1 - 0.15 * risk_score)), 3)
        results.append(
            {
                "source": p,
                "provider_display": provider_display.get(p, p),
                "provider_logo": provider_logo.get(p, "/static/images/providers/default.svg"),
                "id": f"{p}-{i}",
                "name": name,
                "title": name,
                "snippet": snippet,
                "person_name": person_name,
                "gender": gender,
                "age": age,
                "risk_tags": risk_tags,
                "risk_score": risk_score,
                "match_score_adjusted": match_score_adjusted,
                "url": f"https://mock.{p}.example/{i}",
                "match_score": score,
                "score": score,
                "pub_date": pub_date,
                "companies": [],
            }
        )

    # sort by match_score desc
    results = sorted(results, key=lambda r: r.get("match_score", 0), reverse=True)
    return results[:top_k]
