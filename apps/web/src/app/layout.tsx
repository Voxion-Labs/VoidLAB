import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import { UserProvider } from "@/context/UserContext";

export const metadata: Metadata = {
  title: "VoidLAB - Local IDE",
  description: "Local-first browser IDE, compiler, and workspace by Voxion Labs.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider>
          <UserProvider>
            {children}
            <footer className="voidlab-footer">© Voxion Labs. All rights reserved.</footer>
          </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
