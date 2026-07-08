import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Ethara — Seat Allocation & Project Mapping",
  description: "Full-stack system for managing seat allocation, project mapping, and analytics for 5,000+ employees.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 ml-64 p-6 overflow-x-hidden bg-slate-50">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
