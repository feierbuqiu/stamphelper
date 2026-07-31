import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

// Compile-time constant only: never interpolate profile or request data here.
// The static packager pins this exact inline source with a CSP SHA-256 hash.
const themeBootScript = `(() => {
  try {
    const saved = JSON.parse(localStorage.getItem("tie-piao-profile-v3") || "null");
    const theme = saved?.theme === "light" || saved?.theme === "dark" ? saved.theme : "system";
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.colorScheme = theme === "system"
      ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : theme;
  } catch {
    document.documentElement.dataset.theme = "system";
    document.documentElement.dataset.colorScheme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
})();`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://stamphelper-cn.feierbuqiu.uk"),
  title: "贴票助手｜中国邮政静态邮资与邮票组合计算器",
  description: "按提供国际业务的普遍服务柜台可贴票业务计算邮资，支持自定义纪特邮票与本机持久化库存，并给出精确优先、张数最少的贴法。",
  icons: { icon: "/favicon.svg" },
  alternates: { canonical: "/" },
  openGraph: {
    title: "贴票助手｜把邮资贴得刚刚好",
    description: "静态邮资计算、自定义纪特邮票、本机持久化库存、精确优先、张数最少。",
    locale: "zh_CN",
    type: "website",
    images: [{ url: "/og-postage.png", width: 1736, height: 907, alt: "普通邮票组成精确等式" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "贴票助手｜把邮资贴得刚刚好",
    description: "静态邮资计算、自定义纪特邮票、本机持久化库存、精确优先、张数最少。",
    images: ["/og-postage.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeBootScript }} /></head>
      <body className={geistSans.variable}>{children}</body>
    </html>
  );
}
