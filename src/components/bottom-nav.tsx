"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Inicio", icon: "🏠" },
  { href: "/gastos", label: "Gastos", icon: "📋" },
  { href: "/mama", label: "Mamá", icon: "❤️" },
  { href: "/duvan", label: "Duvan", icon: "🏍️" },
  { href: "/historial", label: "Historial", icon: "📊" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-stone-900/95 backdrop-blur-sm border-t border-stone-800 safe-area-bottom">
      <div className="flex items-center justify-around px-2 py-1">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-colors min-w-[60px] ${
                isActive
                  ? "text-amber-400"
                  : "text-stone-500 hover:text-stone-300"
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-[10px] font-medium leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
