import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SuiteNav from "@/components/SuiteNav";
import Sidebar from "@/components/Sidebar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "INA Procure",
  description:
    "A procurement agent: finds material shortfalls, compares approved vendors, and raises purchase orders for human approval.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-bg text-txt antialiased">
        {/* The shell is the same on every page: suite chrome across the top,
            the section rail down the left, the section itself in the rest. */}
        <div className="flex h-[100dvh] flex-col">
          <SuiteNav />
          <div className="flex min-h-0 flex-1">
            <Sidebar />
            <main className="flex min-w-0 flex-1 flex-col">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
