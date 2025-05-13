import type { Metadata } from "next";
import "./global.scss";

export const metadata: Metadata = {
  title: "안전산행투어",
  description: "등산 위험지역과 대피소 정보를 알려주는 웹 지도 서비스 입니다.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        {children}
      </body>
    </html>
  );
}
