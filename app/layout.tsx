import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Study Space",
  description: "A modern all-in-one workspace for students.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
