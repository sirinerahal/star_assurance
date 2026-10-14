const ETAPES = [
  { numero: 1, titre: "Configuration", sous: "de la campagne" },
  { numero: 2, titre: "Sélection des clients", sous: "Définition" },
  { numero: 3, titre: "Contenu du message", sous: "Création" },
  { numero: 4, titre: "Validation", sous: "Revue" },
  { numero: 5, titre: "Lancement", sous: "Planification" },
];

export default function CampagneStepper({ etapeActive = 1 }: { etapeActive?: number }) {
  return (
    <div className="flex items-center gap-4 overflow-x-auto pb-1">
      {ETAPES.map((etape, i) => {
        const estActive = etape.numero === etapeActive;
        const estTerminee = etape.numero < etapeActive;
        return (
          <div key={etape.numero} className="flex items-center gap-4 shrink-0">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                  estActive
                    ? "bg-[var(--color-primary)] text-white"
                    : estTerminee
                    ? "bg-[var(--color-success)] text-white"
                    : "bg-[var(--color-surface)] text-[var(--color-slate)] border border-[var(--color-border)]"
                }`}
              >
                {etape.numero}
              </div>
              <div className="leading-tight">
                <p
                  className={`text-sm font-medium ${
                    estActive ? "text-[var(--color-ink)]" : "text-[var(--color-slate)]"
                  }`}
                >
                  {etape.titre}
                </p>
                <p className="text-[11px] text-[var(--color-slate)]">{etape.sous}</p>
              </div>
            </div>
            {i < ETAPES.length - 1 && <div className="w-8 h-px bg-[var(--color-border)] shrink-0" />}
          </div>
        );
      })}
    </div>
  );
}
