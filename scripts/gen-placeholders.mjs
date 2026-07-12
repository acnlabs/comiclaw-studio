// 生成演示用 SVG 占位图(public/demo/)
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const outDir = join(process.cwd(), "public", "demo");
mkdirSync(outDir, { recursive: true });

function svg({ name, label, sub, from, to, w = 800, h = 1000 }) {
  const content = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>
  <rect width="${w}" height="${h}" fill="black" opacity="0.25"/>
  <text x="50%" y="47%" text-anchor="middle" fill="#ffffff" font-size="${Math.round(w / 12)}" font-weight="bold" font-family="sans-serif">${label}</text>
  <text x="50%" y="56%" text-anchor="middle" fill="#ffffffcc" font-size="${Math.round(w / 24)}" font-family="sans-serif">${sub}</text>
</svg>
`;
  writeFileSync(join(outDir, `${name}.svg`), content);
}

const portraits = [
  ["char-daxia-v1", "大虾队长 V1", "写实风数字人 · 深海橙", "#b3541e", "#1e2a4a"],
  ["char-daxia-v2", "大虾队长 V2", "国漫风数字人 · 铠甲金", "#d98b2b", "#3a1e4a"],
  ["scene-sea", "深海片场", "幽蓝光柱 · 悬浮摄影机", "#123a5e", "#0b1026"],
  ["scene-stage", "赛博发布厅", "霓虹环幕 · 全息舞台", "#4a1e6e", "#0b2640"],
  ["prop-clapper", "金色场记板", "开拍信物 · 鎏金纹理", "#8a6d1e", "#26160b"],
];
for (const [name, label, sub, from, to] of portraits) {
  svg({ name, label, sub, from, to });
}

const shots = [
  ["shot-1", "镜头 01 · 开场", "深海光柱中 LOGO 浮现", "#0e3350", "#091022"],
  ["shot-2", "镜头 02 · 登场", "大虾队长破浪而出", "#b3541e", "#101a33"],
  ["shot-3", "镜头 03 · 能力", "挥动场记板召唤分镜", "#6e3fa0", "#0e2033"],
  ["shot-4", "镜头 04 · 场景", "发布厅全息演示成片", "#1e6e5a", "#101a33"],
  ["shot-5", "镜头 05 · 收尾", "口号定格 · 二维码浮现", "#a0323f", "#0b1026"],
  ["cover", "漫剧大虾", "15s 智能体宣传短视频", "#d98b2b", "#101a33"],
];
for (const [name, label, sub, from, to] of shots) {
  svg({ name, label, sub, from, to, w: 1280, h: 720 });
}

console.log(`generated ${portraits.length + shots.length} svg files in public/demo/`);
