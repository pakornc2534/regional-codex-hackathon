import { Component, createContext, Suspense, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { OrthographicCamera, type Group } from 'three'
import { ProjectMarkers } from './ProjectMarkers'
import { Diorama, type HoveredLocation, type LocationProps } from './Diorama'
import { describeTarget, workflowZones, type SceneTarget, type ShopSceneProps } from './scene-model'
import { SceneCallouts } from './SceneCallouts'
import { stations, workspaceNames } from '../workspaces'
import './scene.css'

export type { SceneZone, SceneVariant, ShopSceneProps } from './scene-model'

const initialPosition: [number, number, number] = [16, 13, 20]
const initialTarget: [number, number, number] = [0, 1.05, .47]

interface LocationControls {
  labels: ShopSceneProps['labels']
  active: boolean
  hovered: string | null
  copy: number
  anchors: Map<string, Group>
  setHovered: (target: string | null, copy?: number) => void
  open: (target: SceneTarget) => void
  isDragging: () => boolean
}

const LocationContext = createContext<LocationControls | null>(null)

function locationKey(target: SceneTarget, shelf = false) {
  return target.zone === 'product' ? `${target.variant.id}:${shelf ? 'shelf' : 'pedestal'}` : target.zone
}

function Location({ target, parts, shelf }: LocationProps) {
  const controls = useContext(LocationContext)
  if (!controls) throw new Error('Missing scene location controls')

  const key = locationKey(target, shelf)
  const { active, hovered, setHovered, isDragging, open, anchors } = controls
  const anchor = parts[hovered === key ? controls.copy : 0]?.pin
  useLayoutEffect(() => {
    if (anchor) anchors.set(key, anchor)
    return () => { anchors.delete(key) }
  }, [anchors, key, anchor])

  return (
    <group>
      {parts.map(({ mesh }, copy) => <primitive key={mesh.uuid} object={mesh}
        onPointerMove={(event: ThreeEvent<PointerEvent>) => {
          event.stopPropagation()
          if (active && !isDragging()) setHovered(key, copy)
        }}
        onPointerOut={() => {
          if (hovered === key) setHovered(null)
        }}
        onClick={(event: ThreeEvent<MouseEvent>) => {
          event.stopPropagation()
          if (active && event.delta <= 5 && !isDragging()) open(target)
        }}
      />)}
    </group>
  )
}

function ShelfMarker({ target, controls, elements }: {
  target: SceneTarget
  controls: LocationControls
  elements: Map<string, HTMLDivElement>
}) {
  const key = locationKey(target, true)
  const { active, hovered, setHovered, isDragging, open, labels } = controls
  const selected = active && hovered === key
  const { title, detail } = describeTarget(target, labels)

  const show = () => {
    if (active && !isDragging() && !selected) setHovered(key)
  }
  const clear = () => {
    if (selected) setHovered(null)
  }

  return (
    <div className="diorama-marker-position" ref={element => {
      if (element) elements.set(key, element)
      else elements.delete(key)
    }}>
      <button type="button" className="diorama-dot" aria-label={`เปิดสินค้า ${title}`} aria-description={detail}
        disabled={!active} onFocus={show} onBlur={clear} onClick={() => { if (active && !isDragging()) open(target) }} />
    </div>
  )
}

function Camera({ resetKey, clearHover, active }: { resetKey: number; clearHover: () => void; active: boolean }) {
  const camera = useThree(state => state.camera)
  const { width, height } = useThree(state => state.size)
  const invalidate = useThree(state => state.invalidate)
  const baseZoom = Math.min(width / 19.0, height / 12.15)
  const previousZoom = useRef(baseZoom)

  useEffect(() => {
    if (!(camera instanceof OrthographicCamera)) return
    camera.position.set(...initialPosition)
    camera.lookAt(...initialTarget)
    camera.zoom = previousZoom.current
    camera.updateProjectionMatrix()
    invalidate()
  }, [camera, invalidate, resetKey])

  useEffect(() => {
    if (!(camera instanceof OrthographicCamera) || !baseZoom) return
    camera.zoom = camera.zoom * (baseZoom / (previousZoom.current || 1))
    previousZoom.current = baseZoom
    camera.updateProjectionMatrix()
    invalidate()
  }, [baseZoom, camera, invalidate])

  return (
    <OrbitControls
      key={resetKey}
      makeDefault
      enabled={active}
      target={initialTarget}
      enablePan={false}
      enableDamping={false}
      minPolarAngle={.40}
      maxPolarAngle={1.20}
      minAzimuthAngle={-.32}
      maxAzimuthAngle={1.24}
      minZoom={baseZoom * .81}
      maxZoom={baseZoom * 2.2}
      rotateSpeed={.68}
      onChange={clearHover}
    />
  )
}

function Fallback({ variants, selectedVariantId, onOpen, active = true }: ShopSceneProps) {
  const selected = variants.find(variant => variant.id === selectedVariantId) ?? variants[0]
  return (
    <div className="diorama-fallback">
      <strong>มุมมองร้านแบบ 2D</strong>
      <p>อุปกรณ์นี้เปิดภาพ 3D ไม่ได้ เลือกจุดทำงานด้านล่างได้เลย</p>
      <div className="diorama-fallback__zones">
        {selected && <button type="button" disabled={!active} onClick={() => onOpen('product', selected.id)}>{workspaceNames[stations.product.page]} · {stations.product.name}</button>}
        {workflowZones.map(zone => (
          <button key={zone} type="button" disabled={!active} onClick={() => onOpen(zone)}>{workspaceNames[stations[zone].page]} · {stations[zone].name}</button>
        ))}
      </div>
      <div className="diorama-fallback__zones">
        {variants.map(variant => (
          <button key={variant.id} type="button" aria-disabled={!active} tabIndex={active ? 0 : -1} aria-pressed={variant.id === selected?.id} onClick={() => { if (active) onOpen('product', variant.id) }}>{variant.sku}</button>
        ))}
      </div>
    </div>
  )
}

class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { broken: boolean }> {
  state = { broken: false }

  static getDerivedStateFromError() {
    return { broken: true }
  }

  render() {
    return this.state.broken ? this.props.fallback : this.props.children
  }
}

export default function ShopScene(props: ShopSceneProps) {
  const { variants, selectedVariantId, onOpen, labels, resetKey = 0, active = true } = props
  const selected = variants.find(variant => variant.id === selectedVariantId) ?? variants[0]
  const [showLabels, setShowLabels] = useState(true)
  const [hover, setHover] = useState<HoveredLocation | null>(null)
  const hovered = hover?.key ?? null
  const setHovered = (key: string | null, copy = 0) => setHover(previous =>
    key === null ? null : previous?.key === key && previous.copy === copy ? previous : { key, copy })
  const anchors = useRef(new Map<string, Group>())
  const elements = useRef(new Map<string, HTMLDivElement>())
  const view = useRef<HTMLDivElement>(null)
  const pointer = useRef<{ x: number; y: number; id: number } | null>(null)
  const drag = useRef(false)
  const clearHover = useCallback(() => setHover(null), [])

  useEffect(() => {
    clearHover()
  }, [active, clearHover, props.fullScreen, resetKey])

  const open = (target: SceneTarget) => {
    clearHover()
    onOpen(target.zone, target.zone === 'product' ? target.variant.id : undefined)
  }

  const controls = { labels, active, hovered, copy: hover?.copy ?? 0, setHovered, open, anchors: anchors.current, isDragging: () => drag.current }
  const zone = workflowZones.find(zone => zone === hovered)
  const variant = !zone && hovered ? variants.find(item => hovered === item.id + ':shelf' || hovered === item.id + ':pedestal') : undefined
  const focused = zone ? { zone } : variant ? { zone: 'product' as const, variant } : undefined
  const fallback = <Fallback {...props} />
  return (
    <div
      className="diorama"
      aria-label="ร้านของสะสม 3D"
      data-hovering={active && Boolean(hovered)}
      data-labels={showLabels ? 'shown' : 'hidden'}
      onPointerDownCapture={event => {
        pointer.current = { x: event.clientX, y: event.clientY, id: event.pointerId }
        drag.current = false
      }}
      onPointerMoveCapture={event => {
        if (!event.buttons) drag.current = false
        const start = pointer.current
        if (!start || start.id !== event.pointerId || !event.buttons || drag.current) return
        if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 4) {
          drag.current = true
          clearHover()
        }
      }}
      onPointerUpCapture={() => {
        pointer.current = null
      }}
      onPointerCancelCapture={() => {
        pointer.current = null
        drag.current = false
        clearHover()
      }}
      onPointerLeave={() => {
        pointer.current = null
        drag.current = false
        clearHover()
      }}
      onKeyDownCapture={() => { drag.current = false }}
    >
      <div className="diorama-view" ref={view}><SceneBoundary fallback={fallback}>
        <Suspense fallback={<div className="diorama-loading">กำลังเปิดร้าน 3D…</div>}>
          <Canvas
            orthographic
            shadows
            frameloop="demand"
            dpr={[1, 1.5]}
            camera={{ position: initialPosition, near: .1, far: 90 }}
            gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
            onPointerMissed={clearHover}
            fallback={fallback}
          >
            <ambientLight intensity={.54} color="#eef0f2" />
            <hemisphereLight args={['#f6f6f4', '#77858b', .99]} />
            <directionalLight
              position={[2, 15, 6]}
              color="#fff1db"
              intensity={2.23}
              castShadow
              shadow-mapSize={[1024, 1024]}
              shadow-camera-left={-10}
              shadow-camera-right={10}
              shadow-camera-top={10}
              shadow-camera-bottom={-10}
              shadow-normalBias={.056}
              shadow-bias={-.0003}
              shadow-radius={3}
            />
            <directionalLight position={[7, 4, 3]} intensity={.66} color="#c7d9ec" />
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.727, 0]} receiveShadow>
              <planeGeometry args={[80, 80]} />
              <shadowMaterial color="#303943" opacity={.13} depthWrite={false} />
            </mesh>
            <LocationContext.Provider value={controls}>
              <Diorama variants={variants} selected={selected} shopName={props.shopName} location={Location} hover={active ? hover : null}
                markers={corners => <ProjectMarkers corners={corners} anchors={anchors.current} elements={elements.current} view={view}
                  hovered={active ? hovered : null} selectedId={selected?.id} shown={showLabels} />} />
            </LocationContext.Provider>
            <Camera resetKey={resetKey} clearHover={clearHover} active={active} />
          </Canvas>
        </Suspense>
      </SceneBoundary>
        <div className="diorama-markers">
          {variants.slice(0, 13).map(variant => (
            <ShelfMarker key={variant.id} target={{ zone: 'product', variant }} controls={controls} elements={elements.current} />
          ))}
        </div>
      </div>
      <SceneCallouts selected={selected} labels={labels} active={active} shown={showLabels} focused={active ? focused : undefined}
        onToggle={() => setShowLabels(value => !value)}
        onHover={zone => setHovered(zone === 'product' && selected ? locationKey({zone, variant: selected}, anchors.current.has(selected.id + ':shelf')) : zone)}
        onOpen={target => { if (active && !drag.current) open(target) }} />
    </div>
  )
}
