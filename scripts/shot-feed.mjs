// 截取推荐信息流效果(横版视频 + 滑动第二条)
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const outDir = process.argv[2] ?? "/tmp/screenshots";
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

await page.goto("http://localhost:3000/", { waitUntil: "load" });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${outDir}/feed-1.png` });

// 模拟向下滑动一条
await page.locator('button[title="下一个"]').click();
await page.waitForTimeout(2000);
await page.screenshot({ path: `${outDir}/feed-2.png` });

await browser.close();
console.log("done");
