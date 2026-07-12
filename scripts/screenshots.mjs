// 截取各页面效果图(仅用于演示,不参与构建)
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const outDir = process.argv[2] ?? "/tmp/screenshots";
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

async function shot(url, file) {
  await page.goto(`http://localhost:3000${url}`, { waitUntil: "load" });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${outDir}/${file}.png`, fullPage: true });
  console.log(`captured ${file}`);
}

await shot("/", "0-recommend");
await shot("/series", "0-series");
await shot("/studio", "0-studio");

// 短剧详情页(取推荐流里第一个短剧作品)
await page.goto("http://localhost:3000/series", { waitUntil: "load" });
await page.waitForTimeout(500);
const firstWork = await page.locator('a[href^="/w/"]').first().getAttribute("href");
if (firstWork) await shot(firstWork, "0-work-detail");

// 工作台(项目详情页保持 SSE 长连接,不能用 networkidle)
await page.goto("http://localhost:3000/p/demo", { waitUntil: "load" });
await page.waitForTimeout(1000);

const tabs = [
  ["剧本", "1-script"],
  ["资产", "2-assets"],
  ["分镜", "3-storyboard"],
  ["成片", "4-film"],
  ["发行", "5-release"],
];

for (const [label, file] of tabs) {
  await page.locator("main").locator("visible=true").first(); // ensure page ready
  await page.locator("button", { hasText: label }).last().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${outDir}/${file}.png`, fullPage: true });
  console.log(`captured ${file}`);
}

await browser.close();
