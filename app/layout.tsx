import "./globals.css";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";

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
      <body className="bg-[#070b14] text-slate-200 flex h-screen overflow-hidden relative selection:bg-indigo-500 selection:text-white">
        
        <Sidebar />
        
        <div className="flex-1 flex flex-col min-w-0 relative overflow-hidden">
          
          {/* DENGELİ GLOW EFEKTİ: Aşırı sol üst ile merkez arasında bir konuma alındı */}
          <div className="absolute top-4 left-32 w-[550px] h-[550px] bg-indigo-600/20 blur-[140px] pointer-events-none rounded-full z-0"></div>
          <div className="absolute top-1/2 right-10 w-[400px] h-[400px] bg-blue-600/10 blur-[150px] pointer-events-none rounded-full z-0"></div>

          {/* Yeni Canlı Kur ve Profil Barı */}
          <TopBar />

          {/* İçerik Alanı */}
          <main className="flex-1 px-4 py-2 overflow-y-auto relative custom-scrollbar z-10">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}