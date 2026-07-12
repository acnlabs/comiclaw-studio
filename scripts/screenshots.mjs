// 截取工作台各页面效果图(仅用于演示,不参与构建)
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const outDir = process.argv[2] ?? "/tmp/screenshots";
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

await page.goto("http://localhost:3000/", { waitUntil: "load" });
await page.waitForTimeout(800);
await page.screenshot({ path: `${outDir}/0-home.png`, fullPage: true });

// 页面保持 SSE 长连接,不能用 networkidle
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
  await page.locator("nav button", { hasText: label }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${outDir}/${file}.png`, fullPage: true });
  console.log(`captured ${file}`);
}

await browser.close();
