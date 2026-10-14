"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Package,
  Megaphone,
  BarChart3,
  Settings,
  Bot,
  ChevronDown,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Vue d'ensemble", icon: LayoutDashboard, actif: true },
  { href: "/clients", label: "Clients", icon: Users, actif: true },
  { href: "/produits", label: "Produits", icon: Package, actif: true },
];

const NAV_ITEMS_FIN = [
  { href: "/", label: "Tableaux de bord", icon: BarChart3, actif: true },
  { href: "/parametres", label: "Paramètres", icon: Settings, actif: true },
];

const SOUS_MENUS_CAMPAGNES = [
  { href: "/campagnes/nouvelle", label: "Nouvelle", actif: true },
  { href: "/campagnes/mes-campagnes", label: "Mes campagnes", actif: true },
  { href: "/campagnes/historique", label: "Historique", actif: true },
];

export default function Sidebar() {
  const pathname = usePathname();
  const campagnesActives = pathname.startsWith("/campagnes");
  const [campagnesOuvert, setCampagnesOuvert] = useState(campagnesActives);

  return (
    <aside className="w-60 shrink-0 bg-[var(--color-ink)] text-white flex flex-col">
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item, i) => (
          <ElementNav key={item.label + i} item={item} pathname={pathname} />
        ))}

        {/* Campagnes massives : section repliable */}
        <div>
          <button
            onClick={() => setCampagnesOuvert((v) => !v)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              campagnesActives
                ? "bg-[var(--color-primary)] text-white"
                : "text-slate-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Megaphone size={17} strokeWidth={2} />
            Campagnes massives
            <ChevronDown
              size={15}
              className={`ml-auto transition-transform ${campagnesOuvert ? "rotate-180" : ""}`}
            />
          </button>
          {campagnesOuvert && (
            <div className="mt-1 ml-4 pl-3 border-l border-white/10 space-y-0.5">
              {SOUS_MENUS_CAMPAGNES.map((sm) => {
                const isActive = sm.actif && pathname.startsWith(sm.href) && sm.href !== "#";
                const contenu = (
                  <span
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? "bg-white/10 text-white font-medium"
                        : sm.actif
                        ? "text-slate-300 hover:bg-white/5 hover:text-white"
                        : "text-slate-500 cursor-default"
                    }`}
                  >
                    {sm.label}
                    {!sm.actif && (
                      <span className="ml-auto text-[9px] uppercase tracking-wide text-slate-500 border border-slate-600 rounded px-1 py-0.5">
                        bientôt
                      </span>
                    )}
                  </span>
                );
                return sm.actif ? (
                  <Link key={sm.label} href={sm.href}>
                    {contenu}
                  </Link>
                ) : (
                  <div key={sm.label}>{contenu}</div>
                );
              })}
            </div>
          )}
        </div>

        {NAV_ITEMS_FIN.map((item, i) => (
          <ElementNav key={item.label + i} item={item} pathname={pathname} />
        ))}
      </nav>

      <div className="p-4 border-t border-white/10">
        <div className="bg-white/5 rounded-2xl p-4 text-center">
          <div className="w-12 h-12 rounded-full bg-[var(--color-primary)]/20 flex items-center justify-center mx-auto mb-2">
            <Bot size={22} className="text-[var(--color-primary-light)]" />
          </div>
          <p className="font-semibold text-sm">Assistant IA</p>
          <p className="text-[11px] text-slate-400 mt-0.5 mb-3">Votre assistant intelligent à chaque étape.</p>
          <Link
            href="/clients"
            className="block w-full text-xs font-medium bg-white text-[var(--color-ink)] rounded-lg py-2 hover:bg-slate-100 transition-colors"
          >
            Discuter avec l&apos;IA
          </Link>
        </div>
      </div>
    </aside>
  );
}

type Item = { href: string; label: string; icon: React.ElementType; actif: boolean };

function ElementNav({ item, pathname }: { item: Item; pathname: string }) {
  const isActive = item.actif && (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href));
  const Icon = item.icon;
  const contenu = (
    <span
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        isActive
          ? "bg-[var(--color-primary)] text-white"
          : item.actif
          ? "text-slate-300 hover:bg-white/5 hover:text-white"
          : "text-slate-500 cursor-default"
      }`}
    >
      <Icon size={17} strokeWidth={2} />
      {item.label}
      {!item.actif && (
        <span className="ml-auto text-[9px] uppercase tracking-wide text-slate-500 border border-slate-600 rounded px-1 py-0.5">
          bientôt
        </span>
      )}
    </span>
  );
  return item.actif ? <Link href={item.href}>{contenu}</Link> : <div>{contenu}</div>;
}
