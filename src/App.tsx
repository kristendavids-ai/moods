import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import type { Boutique, Brand, Filters, Item, PhotoKind } from "./types";
import { STATUSES } from "./types";
import {
  deleteBoutique,
  deleteBrand,
  deleteItem,
  listBoutiques,
  listBrands,
  listItems,
  newId,
  saveBoutique,
  saveBrand,
  saveItem,
  type PhotoWrite,
} from "./db/store";
import {
  getCategories,
  getSection,
  setCategories as persistCategories,
  setSection as persistSection,
  type Section,
} from "./lib/settings";
import { seasonSortKey } from "./lib/seasons";
import { revokeUrl } from "./lib/image";
import { Header, pad3 } from "./components/Header";
import { Hanger } from "./components/Hanger";
import { CategoryTabs } from "./components/CategoryTabs";
import { Collage } from "./components/Collage";
import { MenuOverlay } from "./components/MenuOverlay";
import { FilterSheet } from "./components/FilterSheet";
import { ItemDetail } from "./components/ItemDetail";
import { ItemForm } from "./components/ItemForm";
import { Settings } from "./components/Settings";
import { Brands } from "./components/Brands";
import { BrandPage } from "./components/BrandPage";
import { BrandForm } from "./components/BrandForm";
import { BoutiqueForm } from "./components/BoutiqueForm";

// The globe, its map data and d3 load only when Boutiques is first opened.
const Boutiques = lazy(() => import("./components/Boutiques").then((m) => ({ default: m.Boutiques })));

type View =
  | { name: "board" }
  | { name: "item"; id: string }
  | { name: "add" }
  | { name: "edit"; id: string; addKind?: PhotoKind }
  | { name: "settings" }
  | { name: "brand"; id: string }
  | { name: "brandForm"; id?: string }
  | { name: "boutiqueForm"; id?: string };

export default function App() {
  const [items, setItems] = useState<Item[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [categories, setCategories] = useState(getCategories);
  const [filters, setFilters] = useState<Filters>({ category: "All", season: null, status: null });
  const [view, setView] = useState<View>({ name: "board" });
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [toastMsg, setToastMsg] = useState<string>();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [boutiques, setBoutiques] = useState<Boutique[]>([]);
  const [section, setSectionState] = useState<Section>(getSection);
  const [bqSelect, setBqSelect] = useState<string>();

  const reloadPlaces = useCallback(
    () => Promise.all([listBrands().then(setBrands), listBoutiques().then(setBoutiques)]),
    [],
  );
  const reload = useCallback(
    () => Promise.all([listItems().then((all) => (setItems(all), setLoaded(true))), reloadPlaces()]),
    [reloadPlaces],
  );
  useEffect(() => {
    reload();
  }, [reload]);

  const toast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg((m) => (m === msg ? undefined : m)), 2200);
  };

  const go = (v: View) => {
    setView(v);
    window.scrollTo({ top: 0 });
  };

  const switchSection = (s: Section) => {
    setSectionState(s);
    persistSection(s);
    if (s !== "boutiques") setBqSelect(undefined);
    go({ name: "board" });
  };

  const createBrand = async (name: string): Promise<Brand> => {
    const b: Brand = { id: newId(), name, euTax: "unknown", createdAt: Date.now() };
    await saveBrand(b);
    await reloadPlaces();
    return b;
  };

  // Categories used by saved items stay visible even if removed from the list.
  const allCategories = useMemo(() => {
    const extra = items.map((i) => i.category).filter((c) => !categories.includes(c));
    return [...categories, ...Array.from(new Set(extra))];
  }, [categories, items]);

  const seasons = useMemo(
    () =>
      Array.from(new Set(items.flatMap((i) => (i.season ? [i.season] : [])))).sort(
        (a, b) => seasonSortKey(b) - seasonSortKey(a) || a.localeCompare(b),
      ),
    [items],
  );

  const visible = items.filter(
    (i) =>
      (filters.category === "All" || i.category === filters.category) &&
      (!filters.season || i.season === filters.season) &&
      (!filters.status || i.status === filters.status),
  );

  const current = "id" in view ? items.find((i) => i.id === view.id) : undefined;

  const onSave = async (item: Item, writes: PhotoWrite[], removed: string[]) => {
    await saveItem(item, writes, removed);
    [...writes.map((w) => w.photo.id), ...removed].forEach(revokeUrl);
    await reload();
    go({ name: "item", id: item.id });
    toast(view.name === "edit" ? "Saved" : "Added to board");
  };

  if (view.name === "add" || (view.name === "edit" && current)) {
    return (
      <ItemForm
        key={view.name}
        categories={allCategories}
        knownSeasons={seasons}
        defaultCategory={filters.category}
        editing={view.name === "edit" ? current : undefined}
        addKind={view.name === "edit" ? view.addKind : undefined}
        onCancel={() => go(current ? { name: "item", id: current.id } : { name: "board" })}
        onSave={onSave}
      />
    );
  }

  if (view.name === "item" && current) {
    return (
      <>
        <ItemDetail
          item={current}
          onBack={() => go({ name: "board" })}
          onEdit={() => go({ name: "edit", id: current.id })}
          onAddPhoto={(addKind) => go({ name: "edit", id: current.id, addKind })}
          onStatus={async (status) => {
            await saveItem({ ...current, status });
            reload();
          }}
          onDelete={async () => {
            await deleteItem(current);
            current.photos.forEach((p) => revokeUrl(p.id));
            await reload();
            go({ name: "board" });
            toast("Removed");
          }}
        />
        {toastMsg && <div className="toast">{toastMsg}</div>}
      </>
    );
  }

  const brand = view.name === "brand" || view.name === "brandForm" ? brands.find((b) => b.id === view.id) : undefined;
  const boutique = view.name === "boutiqueForm" ? boutiques.find((b) => b.id === view.id) : undefined;

  if (view.name === "brandForm") {
    return (
      <BrandForm
        key={view.id ?? "new"}
        editing={brand}
        onCancel={() => go(brand ? { name: "brand", id: brand.id } : { name: "board" })}
        onSave={async (b) => {
          await saveBrand(b);
          await reloadPlaces();
          go({ name: "brand", id: b.id });
          toast(brand ? "Saved" : "Brand added");
        }}
      />
    );
  }

  if (view.name === "brand" && brand) {
    return (
      <>
        <BrandPage
          brand={brand}
          boutiques={boutiques}
          onBack={() => go({ name: "board" })}
          onEdit={() => go({ name: "brandForm", id: brand.id })}
          onTax={async (euTax) => {
            await saveBrand({ ...brand, euTax });
            reloadPlaces();
          }}
          onDelete={async () => {
            await deleteBrand(brand.id);
            await reloadPlaces();
            go({ name: "board" });
            toast("Brand removed");
          }}
          onOpenBoutique={(b) => {
            setBqSelect(b.id);
            setSectionState("boutiques");
            persistSection("boutiques");
            go({ name: "board" });
          }}
        />
        {toastMsg && <div className="toast">{toastMsg}</div>}
      </>
    );
  }

  if (view.name === "boutiqueForm") {
    return (
      <BoutiqueForm
        key={view.id ?? "new"}
        editing={boutique}
        brands={brands}
        onCreateBrand={createBrand}
        onCancel={() => go({ name: "board" })}
        onSave={async (b) => {
          await saveBoutique(b);
          await reloadPlaces();
          setBqSelect(b.id);
          go({ name: "board" });
          toast(boutique ? "Saved" : "Boutique added");
        }}
        onDelete={async () => {
          await deleteBoutique(boutique!.id);
          await reloadPlaces();
          setBqSelect(undefined);
          go({ name: "board" });
          toast("Boutique removed");
        }}
      />
    );
  }

  if (view.name === "settings") {
    return (
      <>
        <Settings
          categories={categories}
          onCategories={(c) => {
            setCategories(c);
            persistCategories(c);
          }}
          onBack={() => go({ name: "board" })}
          onChanged={reload}
          toast={toast}
        />
        {toastMsg && <div className="toast">{toastMsg}</div>}
      </>
    );
  }

  const menuOverlay = menu && (
    <MenuOverlay
      section={section}
      counts={{ board: items.length, brands: brands.length, boutiques: boutiques.length }}
      onSection={switchSection}
      categories={allCategories}
      seasons={seasons}
      items={items}
      filters={filters}
      onFilters={setFilters}
      onClose={() => setMenu(false)}
      onSettings={() => go({ name: "settings" })}
      onAdd={() => go({ name: "add" })}
      onOpenItem={(i) => go({ name: "item", id: i.id })}
    />
  );

  if (section !== "board") {
    const count = section === "brands" ? brands.length : boutiques.length;
    return (
      <>
        <header className="header">
          <Header open={menu} count={count} onToggle={() => setMenu(true)} onHome={() => switchSection("board")} />
        </header>
        {section === "brands" ? (
          <Brands
            brands={brands}
            boutiques={boutiques}
            onOpen={(b) => go({ name: "brand", id: b.id })}
            onAdd={() => go({ name: "brandForm" })}
          />
        ) : (
          <Suspense fallback={<div className="empty"><p className="mute">Loading the globe…</p></div>}>
            <Boutiques
              boutiques={boutiques}
              brands={brands}
              initial={bqSelect}
              onAdd={() => go({ name: "boutiqueForm" })}
              onEdit={(b) => go({ name: "boutiqueForm", id: b.id })}
              onOpenBrand={(b) => go({ name: "brand", id: b.id })}
            />
          </Suspense>
        )}
        {menuOverlay}
        {toastMsg && <div className="toast">{toastMsg}</div>}
      </>
    );
  }

  const activeChips = [
    filters.season && { label: filters.season, clear: () => setFilters({ ...filters, season: null }) },
    filters.status && {
      label: STATUSES.find((s) => s.id === filters.status)!.label,
      clear: () => setFilters({ ...filters, status: null }),
    },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  return (
    <>
      <header className="header">
        <Header
          open={menu}
          count={items.length}
          onToggle={() => setMenu(true)}
          onHome={() => setFilters({ category: "All", season: null, status: null })}
        />
        <CategoryTabs
          categories={allCategories}
          active={filters.category}
          onSelect={(category) => setFilters({ ...filters, category })}
        />
      </header>

      {activeChips.length > 0 && (
        <div className="chips">
          {activeChips.map((c) => (
            <button key={c.label} className="chip" onClick={c.clear}>
              {c.label} <span aria-label="clear">×</span>
            </button>
          ))}
        </div>
      )}

      {loaded && visible.length === 0 ? (
        <div className="empty">
          <Hanger />
          <p>{items.length ? "Nothing filed here yet." : "Your board is empty."}</p>
          <p className="mute">{items.length ? "Try another category or season." : "Add a photo or screenshot to begin."}</p>
        </div>
      ) : (
        <Collage
          key={`${filters.category}|${filters.season}|${filters.status}`}
          items={visible}
          onOpen={(item) => go({ name: "item", id: item.id })}
        />
      )}

      <div className="bars">
        <button className="bar light small" onClick={() => setSheet(true)}>
          <span>Filter</span>
          <span>{activeChips.length ? pad3(activeChips.length).slice(1) : "+"}</span>
        </button>
        <button className="bar" onClick={() => go({ name: "add" })}>
          <span>Add to board</span>
          <span>{pad3(visible.length)}</span>
        </button>
      </div>

      {menuOverlay}
      {sheet && (
        <FilterSheet seasons={seasons} filters={filters} onFilters={setFilters} onClose={() => setSheet(false)} />
      )}
      {toastMsg && <div className="toast">{toastMsg}</div>}
    </>
  );
}
