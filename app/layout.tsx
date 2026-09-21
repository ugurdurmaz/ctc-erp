import "./globals.css";
import AppLayoutClient from "./components/AppLayoutClient";

export const metadata = {
  title: "CTC Master Ledger",
  description: "Finans & Stok Yönetimi",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr">
      <body className="bg-[#070b14] text-slate-200 min-h-screen overflow-hidden relative selection:bg-indigo-500 selection:text-white print:h-auto print:overflow-visible print:bg-white print:text-black print:block">
        <AppLayoutClient>
          {children}
        </AppLayoutClient>
      </body>
    </html>
  );
}