import type { Metadata, Viewport } from "next";
import { ExtensionAttributeCleanup } from "@/components/security/extension-attribute-cleanup";
import "./globals.css";

export const metadata: Metadata = {
  title: "Study Space",
  description: "A modern all-in-one workspace for students.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ExtensionAttributeCleanup />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
