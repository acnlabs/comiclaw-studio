<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 项目当前阶段：开发中，尚未面向市场

生产库里的数据都是测试数据。生产上的 AgentPlanet 登记与 Store 商品同样是测试
记录：目前**没有在售商品，也没有真实订单**。

由此推出几条会反复用到的判断：

- **不要为存量数据写迁移、回滚、续做逻辑。** 直接清掉或重来。涉及 AgentPlanet
  登记 / Store 的存量记录同理——除对方明确要求保留的以外，注销后走正常流程
  重建即可（角色改一次价就会按当前主体重新登记上架）。
- **"是否 money-critical"看当前是否真有在售商品与在途订单，不是看代码路径是否
  涉及金额。** 代码里带 credits 不等于此刻有钱在里面。判断前先去对账：对方给过
  的清单、或 `getAssetRegistration` / `getCharacterListing` 读一眼。
- **一次性操作不要做界面。** 一条数据、一次执行的事情，脚本就够。运维页面适合
  会反复用、或操作者不该碰终端的场景；否则跑完第二天就是没人敢点的死按钮。
- **代码审核会奖励"加防护"，但不会告诉你"这段逻辑不该存在"。** 收到一串"这里
  有洞"的反馈时，先问一遍这个东西是否需要存在，再决定要不要补洞。

这些前提会变。真的开始有对外流量、有在售商品时，请连同这一节一起更新。
