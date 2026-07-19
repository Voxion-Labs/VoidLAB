import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import { UserProvider } from "@/context/UserContext";

export const metadata: Metadata = {
  title: "VoidLAB - Local IDE",
  description: "Local-first browser IDE, compiler, and workspace by Voxion Labs.",
};

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
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
