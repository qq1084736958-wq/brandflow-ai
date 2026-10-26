import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BrandFlow AI｜品牌内容生成与审核",
  description: "从品牌资料到合规内容的一站式 AI 工作流",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
