import type { Metadata } from "next";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "./globals.css";
import "@xyflow/react/dist/style.css";
import WalletProvider from "@/components/wallet-provider";
export const metadata: Metadata = {
  icons: { icon: "/favicon.svg" },
  title: "HireMe — Your next team is agentic.",
  description: "전문 AI 에이전트를 연결하고 실행하는 HireMe 인터랙티브 웹 데모",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
