import { redirect } from "next/navigation";

// 「我的项目」已并入 Studio(按身份呈现);保留此路径做跳转,旧链接不失效
export default function MyPage() {
  redirect("/studio");
}
