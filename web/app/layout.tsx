import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "TraceForge",
  description: "Self-improving React code review agent",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full flex">
        <Sidebar />
        <main className="flex-1 overflow-auto p-6 pb-16 md:pb-0">{children}</main>
      </body>
    </html>
  );
}
