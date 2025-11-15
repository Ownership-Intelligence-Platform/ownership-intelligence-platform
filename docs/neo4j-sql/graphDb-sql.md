Completed (2/3) _Draft Cypher relationship query_

你要的是“像图一样能直接看到人和人之间如何相连”，我给你两类方案：一类是在 Neo4j Browser 里直接画出节点和边；另一类返回 nodes/links 结构，供你们现有前端直接渲染。

## 在 Neo4j Browser 直接看到“人—公司—人”的关系图

最直观：返回节点和真实边，Browser 会直接画出来。

1. 以某个人为中心，看到与其共享公司的所有其他人

- 设置参数
  ```
  :param personId => 'P1';
  ```
- 查询
  ```cypher
  MATCH (p0:Entity {id: $personId})
  WHERE p0.type = 'Person'
  MATCH (p0)-[r1:LEGAL_REP|SERVES_AS]->(c:Entity)<-[r2:LEGAL_REP|SERVES_AS]-(other:Entity)
  WHERE other.type = 'Person' AND other.id <> p0.id
  RETURN p0, r1, c, r2, other
  LIMIT 500;
  ```

2. 看两个人之间最近的“穿透”路径（允许经过职务/法人、股权、担保）

- 设置参数
  ```
  :param personA => 'P123';
  :param personB => 'P456';
  ```
- 查询
  ```cypher
  MATCH (a:Entity {id: $personA}), (b:Entity {id: $personB})
  WHERE a.type='Person' AND b.type='Person'
  MATCH p = shortestPath((a)-[:LEGAL_REP|SERVES_AS|OWNS|GUARANTEES*1..10]-(b))
  RETURN p;
  ```
  提示：把最大深度 10 适当调小/调大以控制性能和结果广度。

3. 整体“人—公司—人”网络的一小片段（用于全局察看）

```cypher
MATCH (p1:Entity)-[r1:LEGAL_REP|SERVES_AS]->(c:Entity)<-[r2:LEGAL_REP|SERVES_AS]-(p2:Entity)
WHERE p1.type='Person' AND p2.type='Person' AND p1.id < p2.id
RETURN p1, r1, c, r2, p2
LIMIT 1000;
```

可加公司或人名/行业过滤，避免一次返回过大。

## 返回 nodes/links 结构（前端可直接画）

如果你想一次把“图的数据”拉回后在前端自定义绘图（类似你们 `get_person_network` 的返回结构），用下面这个：

- 参数
  ```
  :param personId => 'P1';
  ```
- 查询

  ```cypher
  MATCH (p0:Entity {id: $personId})
  WHERE p0.type = 'Person'

  // p0 直接相关的公司与边
  OPTIONAL MATCH (p0)-[r0:LEGAL_REP|SERVES_AS]->(c:Entity)
  WITH p0, collect(DISTINCT c) AS companies,
       collect(DISTINCT {from: p0.id, to: c.id, type: type(r0), role: r0.role}) AS p0_links

  // 通过这些公司找到其他人及其边
  UNWIND companies AS c1
  OPTIONAL MATCH (c1)<-[r:LEGAL_REP|SERVES_AS]-(other:Entity)
  WHERE other.type='Person' AND other.id <> p0.id
  WITH p0, companies,
       p0_links,
       collect(DISTINCT other) AS others,
       collect(DISTINCT {from: other.id, to: c1.id, type: type(r), role: r.role}) AS other_links

  // 为共享公司的人对构造一个“逻辑边”（说明他们共享某公司）
  WITH p0, companies, p0_links, others, other_links
  OPTIONAL MATCH (p0)-[:LEGAL_REP|SERVES_AS]->(c2:Entity)<-[:LEGAL_REP|SERVES_AS]-(o:Entity)
  WHERE o.type='Person' AND o.id <> p0.id
  WITH p0, companies, p0_links, others, other_links,
       collect(DISTINCT {a: p0.id, b: o.id, company: c2.id}) AS shared_pairs

  RETURN
    p0 AS person,
    // 节点列表（人 + 公司）
    [n IN (others + companies + [p0]) WHERE n IS NOT NULL |
      {id: n.id, name: n.name, type: n.type}
    ] AS nodes,
    // 边列表（人->公司 + 人<->人共享公司）
    (
      // 人->公司
      [l IN (p0_links + other_links) WHERE l.to IS NOT NULL |
        {source: l.from, target: l.to, type: l.type, role: l.role}
      ] +
      // 人<->人（共享公司）
      [s IN shared_pairs |
        {source: s.a, target: s.b, type: 'SHARE_COMPANY', company_id: s.company}
      ]
    ) AS links;
  ```

  说明：

- 在 Neo4j Browser 里这会返回一行 JSON 风格的 nodes/links；Browser 不直接把这行渲染成图，但前端拿到后就能画。
- 想直接看到“图形”，优先使用上一节“返回节点和真实边”的查询。

## 现有前端可直接看图

你已经可以用现有页面看“人际网络图”：

- 打开: http://localhost:8000/static/person_network.html?person=<ID>
- 例如: http://localhost:8000/static/person_network.html?person=P1
  这个页面正是调用 `GET /person-network/{person_id}`（由 person_network.py 提供 nodes/links 数据）并用 D3 可视化。

需要我把“多个人比较”的图也做成一个新接口/新页面（比如传入 personA/personB 返回他们之间最短路径并渲染）吗？我可以帮你补一个 router 和对应服务函数，前端加个轻量页面就能点开看。
