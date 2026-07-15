-- AgentPlanet Store 集成:付费角色上架为 agent_asset 商品,付费授权走 Store 订单
ALTER TABLE "AgentCharacter" ADD COLUMN "storeProductId" TEXT;

ALTER TABLE "CastingLicense" ADD COLUMN "storeOrderId" TEXT;

CREATE UNIQUE INDEX "CastingLicense_storeOrderId_key" ON "CastingLicense"("storeOrderId");
