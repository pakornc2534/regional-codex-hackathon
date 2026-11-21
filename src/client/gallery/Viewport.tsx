import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import type { CameraPose, GalleryMode, GalleryProps, Pick } from "./types";
import type { Zone } from "../../shared/model";
import { statusText } from "./types";
import { createDiorama } from "./sculpture";
import MapCanvas from "./MapCanvas";
const Webgl = lazy(() => import("./Webgl"));
class WebglBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
interface Props extends PickProps {
  variants: GalleryProps["variants"];
  selected: string;
  activity: GalleryProps["activity"];
  mode: GalleryMode;
  highlight: Zone | null;
  bottleneck?: Zone | null;
  reset: number;
  reduced: boolean;
  onFailure: () => void;
}
interface PickProps {
  onHover: (target: Pick | null) => void;
  onPick: (target: Pick) => void;
}
export default function Viewport({
  variants,
  selected,
  activity,
  mode,
  highlight,
  bottleneck,
  reset,
  reduced,
  onFailure,
  onHover,
  onPick,
}: Props) {
  const ids = variants.map((v) => v.id + "=" + v.sku).join("|"),
    latest = useRef(variants);
  latest.current = variants;
  const savedView = useRef<CameraPose | null>(null);
  const scene = useMemo(
    () => createDiorama(latest.current, selected),
    [ids, selected],
  );
  useEffect(() => () => scene.dispose(), [scene]);
  const error = useCallback(() => onFailure(), [onFailure]);
  const map = (
    <MapCanvas
      scene={scene}
      activity={activity}
      highlight={highlight}
      bottleneck={bottleneck}
      onHover={onHover}
      onPick={onPick}
    />
  );
  if (mode === "2d") return map;
  return (
    <WebglBoundary onError={error}>
      <Suspense fallback={map}>
        <Webgl
          activityText={statusText(activity, variants)}
          savedView={savedView}
          scene={scene}
          activity={activity}
          highlight={highlight}
          bottleneck={bottleneck}
          reset={reset}
          reduced={reduced}
          onHover={onHover}
          onPick={onPick}
          onFailure={error}
        />
      </Suspense>
    </WebglBoundary>
  );
}
