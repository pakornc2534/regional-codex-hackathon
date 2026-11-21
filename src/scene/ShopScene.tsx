import { Component, createContext, Suspense, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { ShopIcon } from '../ShopIcon'
import { OrthographicCamera, Vector3, type Group } from 'three'
import { Diorama, type LocationProps } from './Diorama'
import { describeTarget, zoneLabels, workflowZones, type SceneTarget, type ShopSceneProps } from './scene-model'
import './scene.css'

export type { SceneZone, SceneVariant, ShopSceneProps } from './scene-model'

const initialPosition: [number, number, number] = [16, 13, 20]
const initialTarget: [number, number, number] = [0, 1.05, .47]

interface LocationControls {
  labels: ShopSceneProps['labels']
  active: boolean
  hovered: string | null
  anchors: Map<string, Group>
  setHovered: (target: string | null) => void
  open: (target: SceneTarget) => void
  isDragging: () => boolean
}

const LocationContext = createContext<LocationControls | null>(null)

function locationKey(target: SceneTarget, shelf = false) {
  return target.zone === 'product' ? `${target.variant.id}:${shelf ? 'shelf' : 'pedestal'}` : target.zone
}

function Location({ target, at, mesh, shelf }: LocationProps) {
  const controls = useContext(LocationContext)
  if (!controls) throw new Error('Missing scene location controls')

  const key = locationKey(target, shelf)
  const { active, hovered, setHovered, isDragging, open, anchors } = controls

  return (
    <group>
      <group
        onPointerOver={event => {
          event.stopPropagation()
          if (active && !isDragging()) setHovered(key)
        }}
        onPointerOut={() => {
          if (hovered === key) setHovered(null)
        }}
        onClick={event => {
          event.stopPropagation()
          if (active && event.delta <= 5 && !isDragging()) open(target)
        }}
      >
        {mesh}
      </group>
      <group position={at} ref={anchor => {
        if (anchor) anchors.set(key, anchor)
        else anchors.delete(key)
      }} />
    </group>
  )
}

function Marker({ target, shelf = false, controls, elements }: {
  target: SceneTarget
  shelf?: boolean
  controls: LocationControls
  elements: Map<string, HTMLDivElement>
}) {
  const key = locationKey(target, shelf)
  const { active, hovered, setHovered, isDragging, open, labels } = controls
  const selected = active && hovered === key
  const { title, detail } = describeTarget(target, labels)

  const show = () => {
    if (active && !isDragging()) setHovered(key)
  }
  const clear = () => {
    if (selected) setHovered(null)
  }

  return (
    <div className="diorama-marker-position" data-hot={selected || undefined} ref={element => {
      if (element) elements.set(key, element)
      else elements.delete(key)
    }}>
      <div className="diorama-marker">
        <button
          type="button"
          className={shelf ? 'diorama-dot diorama-dot--shelf' : 'diorama-dot'}
          aria-label={shelf ? `เปิดสินค้า ${title}` : title}
          aria-description={detail}
          aria-disabled={!active}
          tabIndex={active ? 0 : -1}
          onFocus={show}
          onBlur={clear}
          onPointerEnter={show}
          onPointerLeave={clear}
          onClick={() => {
            if (active && !isDragging()) open(target)
          }}
        >
          <span aria-hidden="true" className="diorama-dot__lamp" />
          {!shelf && <span className="diorama-dot__text">{target.zone === 'product' ? title : zoneLabels[target.zone].title}</span>}
        </button>
        {selected && <span className="diorama-hover" aria-hidden="true"><strong>{title}</strong>{detail}</span>}
      </div>
    </div>
  )
}

function ProjectMarkers({ anchors, elements }: {
  anchors: Map<string, Group>
  elements: Map<string, HTMLDivElement>
}) {
  const vector = useRef(new Vector3())
  useFrame(({ camera, size }) => {
    camera.updateMatrixWorld()
    for (const [key, anchor] of anchors) {
      const element = elements.get(key)
      if (!element) continue
      const point = anchor.getWorldPosition(vector.current).project(camera)
      const x = Math.round((point.x * .5 + .5) * size.width)
      const y = Math.round((.5 - point.y * .5) * size.height)
      const transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`
      if (element.style.transform !== transform) element.style.transform = transform
      element.style.visibility = Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1 ? 'visible' : 'hidden'
    }
  })
  return null
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

function Fallback({ variants, selectedVariantId, labels, onOpen, active = true }: ShopSceneProps) {
  const selected = variants.find(variant => variant.id === selectedVariantId) ?? variants[0]
  return (
    <div className="diorama-fallback">
      <strong>มุมมองร้านแบบ 2D</strong>
      <p>อุปกรณ์นี้เปิดภาพ 3D ไม่ได้ เลือกจุดทำงานด้านล่างได้เลย</p>
      <div className="diorama-fallback__zones">
        {workflowZones.map(zone => (
          <button key={zone} type="button" aria-disabled={!active} tabIndex={active ? 0 : -1} onClick={() => { if (active) onOpen(zone) }}>{labels?.[zone]?.title ?? zoneLabels[zone].title}</button>
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
  const [showLabels, setShowLabels] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)
  const anchors = useRef(new Map<string, Group>())
  const elements = useRef(new Map<string, HTMLDivElement>())
  const pointer = useRef<{ x: number; y: number; id: number } | null>(null)
  const drag = useRef(false)
  const clearHover = useCallback(() => setHovered(null), [])

  useEffect(() => {
    clearHover()
  }, [active, clearHover, props.fullScreen, resetKey])

  const open = (target: SceneTarget) => {
    clearHover()
    onOpen(target.zone, target.zone === 'product' ? target.variant.id : undefined)
  }

  const controls = { labels, active, hovered, setHovered, open, anchors: anchors.current, isDragging: () => drag.current }
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
      <SceneBoundary fallback={fallback}>
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
              <Diorama variants={variants} selected={selected} shopName={props.shopName} location={Location} />
            </LocationContext.Provider>
            <Camera resetKey={resetKey} clearHover={clearHover} active={active} />
            <ProjectMarkers anchors={anchors.current} elements={elements.current} />
          </Canvas>
        </Suspense>
      </SceneBoundary>
      <button type="button" className="diorama-pins" aria-pressed={showLabels} disabled={!active}
        onClick={() => setShowLabels(value => !value)}>
        <ShopIcon name="pin" size={17} />{showLabels ? 'ซ่อนจุดทำงาน' : 'แสดงจุดทำงาน'}
      </button>
      <div className="diorama-markers">
        {variants.slice(0, 13).map(variant => (
          <Marker key={variant.id} target={{ zone: 'product', variant }} controls={controls} elements={elements.current} shelf />
        ))}
        {selected && <Marker key={`pedestal:${selected.id}`} target={{ zone: 'product', variant: selected }} controls={controls} elements={elements.current} />}
        {workflowZones.map(zone => <Marker key={zone} target={{ zone }} controls={controls} elements={elements.current} />)}
      </div>
    </div>
  )
}
