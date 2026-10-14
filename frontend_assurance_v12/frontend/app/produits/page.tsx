"use client";

import { useEffect, useState } from "react";
import { Check, CircleAlert, Package, Power, RefreshCw } from "lucide-react";
import { getProduits, getRelationProduitsPacks, modifierStatutProduit, Produit, RelationProduitPack } from "@/lib/api";
import { IconeProduit } from "@/lib/produits";

export default function ProduitsPage() {
  const [produits, setProduits] = useState<Produit[]>([]);
  const [chargement, setChargement] = useState(true);
  const [codeEnCours, setCodeEnCours] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "succes" | "erreur"; texte: string } | null>(null);
  const [relations, setRelations] = useState<RelationProduitPack[]>([]);
  const [packsOrphelins, setPacksOrphelins] = useState<RelationProduitPack["packs"]>([]);
  const [controleRelation, setControleRelation] = useState<{
    nb_packs: number;
    nb_packs_orphelins: number;
  } | null>(null);

  async function chargerProduits() {
    setChargement(true);
    try {
      setProduits(await getProduits(true));
      const relation = await getRelationProduitsPacks();
      setRelations(relation.produits);
      setPacksOrphelins(relation.packs_orphelins);
      setControleRelation(relation.controle);
    } catch {
      setMessage({ type: "erreur", texte: "Le catalogue produits est indisponible." });
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    const chargementInitial = window.setTimeout(() => void chargerProduits(), 0);
    return () => window.clearTimeout(chargementInitial);
  }, []);

  async function changerStatut(produit: Produit) {
    const nouvelEtat = !produit.actif;
    setCodeEnCours(produit.produit_code);
    setMessage(null);
    try {
      const produitMisAJour = await modifierStatutProduit(produit.produit_code, nouvelEtat);
      setProduits((precedents) =>
        precedents.map((item) => (item.produit_code === produit.produit_code ? produitMisAJour : item))
      );
      setMessage({
        type: "succes",
        texte: `${produitMisAJour.produit_nom} est maintenant ${produitMisAJour.actif ? "actif" : "inactif"}.`,
      });
    } catch {
      setMessage({ type: "erreur", texte: "Le statut n’a pas pu être enregistré." });
    } finally {
      setCodeEnCours(null);
    }
  }

  const produitsVie = produits.filter((produit) => produit.type_branche !== "Non-Vie");
  const produitsNonVie = produits.filter((produit) => produit.type_branche === "Non-Vie");
  const actifs = produits.filter((produit) => produit.actif).length;

  function afficherProduit(produit: Produit) {
    const enCours = codeEnCours === produit.produit_code;
    const nonVieOfficiel = produit.type_branche === "Non-Vie";
    return (
      <div key={produit.produit_code} className="p-5 flex flex-col lg:flex-row lg:items-center gap-4">
        <IconeProduit code={produit.produit_code} size={21} boxSize={44} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-[var(--color-ink)]">{produit.produit_nom}</h2>
            <span className="text-xs font-mono text-[var(--color-slate)]">#{produit.produit_code}</span>
          </div>
          <p className="text-sm text-[var(--color-slate)] mt-1">{produit.description || produit.categorie}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-[var(--color-slate)]">
            <span>{produit.branche}</span>
            <span>Couverture : {produit.niveau_couverture}</span>
            <span>Canal : {produit.canal_distribution}</span>
          </div>
        </div>
        <div className="flex items-center justify-between lg:justify-end gap-4 lg:w-44">
          <span className={`inline-flex items-center gap-1.5 text-sm font-medium ${produit.actif ? "text-green-700" : "text-slate-500"}`}>
            <span className={`w-2 h-2 rounded-full ${produit.actif ? "bg-green-500" : "bg-slate-400"}`} />
            {produit.actif ? "Actif" : "Inactif"}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={produit.actif}
            aria-label={`${produit.actif ? "Désactiver" : "Activer"} ${produit.produit_nom}`}
            disabled={enCours || nonVieOfficiel}
            onClick={() => void changerStatut(produit)}
            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
              produit.actif ? "bg-[var(--color-success)]" : "bg-slate-300"
            }`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${produit.actif ? "translate-x-6" : "translate-x-1"}`}>
              {enCours && <Power size={12} className="m-1.5 text-slate-500 animate-pulse" />}
            </span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-ink)] flex items-center gap-2.5">
            <Package size={23} className="text-[var(--color-primary)]" />
            Gestion des produits
          </h1>
          <p className="text-[var(--color-slate)] text-sm mt-1">
            Contrôlez les produits disponibles pour les recommandations et les campagnes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void chargerProduits()}
          className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-[var(--color-border)] text-sm font-medium text-[var(--color-ink)] hover:border-[var(--color-primary)] transition-colors"
        >
          <RefreshCw size={16} /> Actualiser
        </button>
      </header>

      {message && (
        <div
          role="status"
          className={`mb-5 flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${
            message.type === "succes"
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message.type === "succes" ? <Check size={17} /> : <CircleAlert size={17} />}
          {message.texte}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-5">
          <p className="text-sm text-[var(--color-slate)]">Produits au catalogue</p>
          <p className="text-2xl font-semibold text-[var(--color-ink)] mt-1">{produits.length}</p>
        </div>
        <div className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl p-5">
          <p className="text-sm text-[var(--color-slate)]">Produits actifs</p>
          <p className="text-2xl font-semibold text-[var(--color-success)] mt-1">{actifs}</p>
        </div>
      </div>

      {!chargement && relations.length > 0 && (
        <details className="mb-6 bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
          <summary className="cursor-pointer px-5 py-4 font-semibold text-sm text-[var(--color-ink)]">
            Vérifier la relation Produit → Packs
          </summary>
          <div className="border-t border-[var(--color-border)] px-5 py-4 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <span>Produits : <strong>{relations.length}</strong></span>
            <span>Avec pack : <strong>{relations.filter((relation) => relation.packs.length > 0).length}</strong></span>
            <span>Sans pack : <strong>{relations.filter((relation) => relation.packs.length === 0).length}</strong></span>
            <span>Packs source : <strong>{controleRelation?.nb_packs ?? 0}</strong></span>
            <span>Packs rattachés : <strong>{(controleRelation?.nb_packs ?? 0) - (controleRelation?.nb_packs_orphelins ?? 0)}</strong></span>
            <span>Packs orphelins : <strong>{controleRelation?.nb_packs_orphelins ?? 0}</strong></span>
            <span>Clé : <strong>produit_id + code_produit</strong></span>
          </div>
          <div className="border-t border-[var(--color-border)] divide-y divide-[var(--color-border)]">
            {relations.map((relation) => (
              <div key={relation.produit_code} className="px-5 py-3 flex flex-col gap-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-sm text-[var(--color-ink)]">{relation.produit_nom}</span>
                  <span className="text-xs text-[var(--color-slate)]">
                    Clé : ({relation.produit_id}, {relation.code_produit})
                  </span>
                </div>
                <p className="text-xs text-[var(--color-slate)]">
                  {relation.packs.length > 0
                    ? relation.packs.map((pack) => `${pack.pack_nom} (${pack.pack_code})`).join(" · ")
                    : "Aucun pack associé dans PACK_PRODUIT.xls"}
                </p>
              </div>
            ))}
          </div>
          <div className="border-t border-[var(--color-border)] px-5 py-4 text-xs text-[var(--color-slate)]">
            Les packs sont associés uniquement si <strong>(produit_id, code_produit)</strong> correspond exactement entre le catalogue et PACK_PRODUIT.xls.
          </div>
          {packsOrphelins.length > 0 && (
            <div className="border-t border-amber-200 bg-amber-50 px-5 py-4 text-xs text-amber-900">
              Packs sans produit correspondant : {packsOrphelins.map((pack) => `${pack.pack_nom} (${pack.pack_code})`).join(" · ")}.
            </div>
          )}
        </details>
      )}

      <div className="space-y-6">
        {chargement ? (
          <div className="p-10 text-center text-sm text-[var(--color-slate)]">Chargement du catalogue...</div>
        ) : produits.length === 0 ? (
          <div className="p-10 text-center text-sm text-[var(--color-slate)]">Aucun produit dans le catalogue.</div>
        ) : (
          <>
            <section className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-[var(--color-border)]">
                <h2 className="font-semibold text-[var(--color-ink)]">Produits Non-Vie</h2>
                <p className="text-sm text-[var(--color-slate)] mt-1">Catalogue officiel des produits Non-Vie actifs.</p>
              </div>
              <div className="divide-y divide-[var(--color-border)]">{produitsNonVie.map(afficherProduit)}</div>
            </section>
            <section className="bg-[var(--color-surface-card)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
              <div className="p-5 border-b border-[var(--color-border)]">
                <h2 className="font-semibold text-[var(--color-ink)]">Produits Vie</h2>
                <p className="text-sm text-[var(--color-slate)] mt-1">Produits Vie déjà présents dans le catalogue.</p>
              </div>
              <div className="divide-y divide-[var(--color-border)]">{produitsVie.map(afficherProduit)}</div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}