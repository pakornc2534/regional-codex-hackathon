import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  ArrowUpRight,
  Box,
  ChartNoAxesColumnIncreasing,
  Check,
  ChevronDown,
  ClipboardList,
  Computer,
  Expand,
  Focus,
  HandCoins,
  Layers,
  MapPin,
  Minimize,
  Package,
  PackageCheck,
  PackageOpen,
  RotateCcw,
  Search,
  Truck,
  Undo2,
  TriangleAlert,
} from "lucide-react";
import { type Zone, zones } from "../shared/model";
import {
  purposes,
  statusText,
  type GalleryProps,
  type Pick,
  type GalleryMode,
} from "./gallery/types";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import "./gallery.css";

const Viewport = lazy(() => import("./gallery/Viewport"));
const zoneOrder = Object.keys(zones) as Zone[];
const zoneIcons = {
  shelf: Box,
  pick: ClipboardList,
  pack: PackageOpen,
  pickup: PackageCheck,
  carrier: Truck,
  returns: Undo2,
  cash: HandCoins,
  dashboard: ChartNoAxesColumnIncreasing,
  computer: Computer,
};
function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)"),
      update = () => setReduced(m.matches);
    m.addEventListener("change", update);
    return () => m.removeEventListener("change", update);
  }, []);
  return reduced;
}
const categoryOf = (v: GalleryProps["variants"][number]) =>
  v.category ?? "สินค้าในร้าน";
const productOf = (v: GalleryProps["variants"][number]) => v.productId ?? v.id;
export default function Gallery({
  variants,
  selected,
  onSelect,
  onOpen,
  activity,
  impact,
  bottleneck = null,
  compact = false,
}: GalleryProps) {
  const id = useId(),
    reduced = useReducedMotion(),
    activityTimer = useRef<number | undefined>(undefined);
  const [mode, setMode] = useState<GalleryMode>("3d"),
    [unavailable, setUnavailable] = useState(false),
    [expanded, setExpanded] = useState(false),
    [reset, setReset] = useState(0);
  const [hover, setHover] = useState<Pick | null>(null),
    [category, setCategory] = useState(""),
    [product, setProduct] = useState(""),
    [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState<Zone | null>(null),
    [visibleActivity, setVisibleActivity] = useState(activity);
  const section = useRef<HTMLElement>(null),
    toggle = useRef<HTMLButtonElement>(null);
  const current = variants.find((v) => v.id === selected) ?? variants[0],
    hovered = variants.find((v) => v.id === hover?.variantId);
  const chain = (impact ?? []).join("|");
  useEffect(() => {
    const list = chain ? (chain.split("|") as Zone[]) : [];
    if (!list.length) {
      setHighlight(null);
      return;
    }
    if (reduced) {
      setHighlight(bottleneck ?? list.at(-1) ?? null);
      return;
    }
    setHighlight(list[0]);
    const handles = list
      .slice(1)
      .map((z, i) => window.setTimeout(() => setHighlight(z), (i + 1) * 440));
    handles.push(
      window.setTimeout(
        () => setHighlight(bottleneck ?? list.at(-1) ?? null),
        list.length * 440,
      ),
    );
    return () => handles.forEach(clearTimeout);
  }, [chain, bottleneck, reduced]);
  useEffect(() => {
    setVisibleActivity(activity);
    window.clearTimeout(activityTimer.current);
    if (activity && activity.status !== "executing")
      activityTimer.current = window.setTimeout(
        () => setVisibleActivity(null),
        4800,
      );
    return () => window.clearTimeout(activityTimer.current);
  }, [activity?.id, activity?.status]);
  useEffect(() => {
    if (!expanded) return;
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    function keydown(e: KeyboardEvent) {
      if (
        e.key === "Escape" &&
        !e.defaultPrevented &&
        !document.querySelector(
          '[role="dialog"][data-state="open"],dialog[open]',
        )
      ) {
        setExpanded(false);
        toggle.current?.focus();
      }
    }
    document.addEventListener("keydown", keydown);
    return () => {
      document.documentElement.style.overflow = previous;
      document.removeEventListener("keydown", keydown);
    };
  }, [expanded]);
  const onHover = useCallback(
    (pick: Pick | null) =>
      setHover((last) =>
        last?.zone === pick?.zone && last?.variantId === pick?.variantId
          ? last
          : pick,
      ),
    [],
  );
  const open = useCallback(
    (pick: Pick) => {
      setHover(null);
      if (pick.variantId) onSelect(pick.variantId);
      onOpen(pick.zone);
    },
    [onOpen, onSelect],
  );
  const noWebgl = useCallback(() => {
    setUnavailable(true);
    setMode("2d");
    setHover(null);
  }, []);
  const selectMode = (next: GalleryMode) => {
    setMode(next);
    setHover(null);
  };
  const categories = Array.from(new Set(variants.map(categoryOf)));
  const byCategory = variants.filter(
    (v) => !category || categoryOf(v) === category,
  );
  const products = Array.from(
    new Map(
      byCategory.map((v) => [productOf(v), v.name.split(" · ")[0]]),
    ).entries(),
  );
  const filtered = byCategory.filter(
    (v) =>
      (!product || productOf(v) === product) &&
      [v.name, v.sku].some((t) =>
        t.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
      ),
  );
  const hoverText = hover
    ? hovered
      ? hovered.sku + " · เหลือขาย " + hovered.available + " ชิ้น"
      : purposes[hover.zone]
    : "";
  const activityIcon =
    visibleActivity?.status === "verified" ? (
      <Check size={13} />
    ) : visibleActivity?.status === "failed" ||
      visibleActivity?.status === "uncertain" ? (
      <TriangleAlert size={13} />
    ) : null;
  return (
    <section
      ref={section}
      className={
        "store-gallery" +
        (compact ? " gallery-compact" : "") +
        (expanded ? " gallery-expanded" : "")
      }
      aria-label="ร้านของสะสมแบบโต้ตอบ"
    >
      <div className="gallery-stage" onPointerLeave={() => setHover(null)}>
        <div className="gallery-shadow" aria-hidden="true" />
        <div className="gallery-viewport">
          <Suspense
            fallback={
              <div className="gallery-loading" role="status">
                <Package size={22} />
                กำลังเปิดร้าน…
              </div>
            }
          >
            <Viewport
              variants={variants}
              selected={selected}
              activity={visibleActivity}
              mode={mode}
              highlight={highlight}
              bottleneck={bottleneck}
              reset={reset}
              reduced={reduced}
              onHover={onHover}
              onPick={open}
              onFailure={noWebgl}
            />
          </Suspense>
        </div>
        <div className="gallery-toolbar">
          <div className="gallery-modebar" aria-label="มุมมองร้าน">
            <Button
              variant="ghost"
              size="sm"
              type="button"
              disabled={unavailable}
              aria-pressed={mode === "3d"}
              onClick={() => selectMode("3d")}
              title={unavailable ? "อุปกรณ์นี้แสดงร้านในมุมมอง 2D" : "มุมมองสามมิติ"}
            >
              <Box size={14} />
              3D
            </Button>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              aria-pressed={mode === "2d"}
              onClick={() => selectMode("2d")}
              title="มุมมองสองมิติ"
            >
              <Layers size={14} />
              2D
            </Button>
          </div>
          <div className="gallery-tools">
            {mode === "3d" && (
              <Button
                variant="ghost"
                size="sm"
                type="button"
                title="คืนมุมกล้อง"
                aria-label="คืนมุมกล้อง"
                onClick={() => {
                  setReset((n) => n + 1);
                  setHover(null);
                }}
              >
                <RotateCcw size={16} />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              type="button"
              ref={toggle}
              title={expanded ? "ย่อมุมมองร้าน" : "ขยายมุมมองร้าน"}
              aria-label={expanded ? "ย่อมุมมองร้าน" : "ขยายมุมมองร้าน"}
              aria-pressed={expanded}
              onClick={() => {
                setExpanded((v) => !v);
                setHover(null);
              }}
            >
              {expanded ? <Minimize size={16} /> : <Expand size={16} />}
            </Button>
          </div>
        </div>
        {hover && (
          <div className="gallery-hover" role="status">
            <MapPin size={15} />
            <span>
              <strong>{zones[hover.zone]}</strong>
              <small>{hoverText}</small>
            </span>
          </div>
        )}
        {highlight && (
          <div
            className={
              "gallery-impact" + (highlight === bottleneck ? " is-limited" : "")
            }
          >
            <Focus size={13} />
            {zones[highlight]}
            {highlight === bottleneck ? " · คอขวด" : ""}
          </div>
        )}
        {current && (
          <Button
            variant="ghost"
            size="sm"
            type="button"
            className="gallery-selection"
            onClick={() => open({ zone: "shelf", variantId: current.id })}
          >
            <span className="gallery-select-icon">
              <Box size={17} />
            </span>
            <span>
              <small>สินค้าที่เลือก</small>
              <b>{current.sku}</b>
            </span>
            <ArrowUpRight size={15} />
          </Button>
        )}
        {mode === "2d" && (
          <div className="gallery-activity" role="status">
            {activityIcon}
            {statusText(visibleActivity, variants)}
          </div>
        )}
      </div>
      <details className="gallery-index" open={expanded || undefined}>
        <summary>
          <span>
            <MapPin size={16} />
            สินค้าและจุดทำงาน
          </span>
          <ChevronDown size={16} />
        </summary>
        <div className="gallery-index-content">
          <label className="gallery-search">
            <Search size={16} />
            <Input
              aria-label="ค้นหาชื่อสินค้า รุ่น หรือ SKU"
              placeholder="ค้นหาชื่อสินค้า รุ่น หรือ SKU"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="gallery-filters">
            <label htmlFor={id + "category"}>
              หมวดสินค้า
              <select
                id={id + "category"}
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setProduct("");
                }}
              >
                <option value="">ทุกหมวด</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label htmlFor={id + "product"}>
              สินค้า
              <select
                id={id + "product"}
                value={product}
                onChange={(e) => setProduct(e.target.value)}
              >
                <option value="">ทุกสินค้า</option>
                {products.map(([key, name]) => (
                  <option key={key} value={key}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor={id + "variant"}>
              รุ่น
              <select
                id={id + "variant"}
                value={filtered.some((v) => v.id === selected) ? selected : ""}
                onChange={(e) => {
                  if (e.target.value) {
                    onSelect(e.target.value);
                    setHover(null);
                  }
                }}
              >
                <option value="">เลือกรุ่น</option>
                {filtered.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.sku} · {v.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {query.trim() && (
            <div className="gallery-search-results" aria-live="polite">
              {filtered.length
                ? filtered.map((v) => (
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      key={v.id}
                      onClick={() => open({ zone: "shelf", variantId: v.id })}
                    >
                      {v.sku}
                      <ArrowUpRight size={12} />
                    </Button>
                  ))
                : "ไม่พบสินค้าที่ค้นหา"}
            </div>
          )}
          <nav className="gallery-zones" aria-label="จุดทำงานในร้าน">
            {zoneOrder.map((z) => {
              const Icon = zoneIcons[z];
              return (
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  key={z}
                  title={purposes[z]}
                  onFocus={() => onHover({ zone: z })}
                  onBlur={() => onHover(null)}
                  onPointerEnter={() => onHover({ zone: z })}
                  onPointerLeave={() => onHover(null)}
                  onClick={() => open({ zone: z })}
                >
                  <Icon size={15} />
                  {zones[z]}
                </Button>
              );
            })}
          </nav>
        </div>
      </details>
    </section>
  );
}
