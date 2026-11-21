import { useLayoutEffect, useRef, type RefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Vector3, type Camera, type Group } from 'three'

type Leader = { group: SVGGElement; path: SVGPolylineElement; dot: SVGCircleElement }
type Start = { x: number; y: number; dx: number; dy: number }

export function ProjectMarkers({ corners, anchors, elements, view, hovered, selectedId, shown }: {
  corners: Vector3[]
  anchors: Map<string, Group>
  elements: Map<string, HTMLDivElement>
  view: RefObject<HTMLDivElement | null>
  hovered: string | null
  selectedId?: string
  shown: boolean
}) {
  const vector = useRef(new Vector3())
  const layout = useRef<ReturnType<typeof measureLayout> | null>(null)
  const invalidate = useThree(state => state.invalidate)
  useLayoutEffect(() => {
    const canvas = view.current
    const frame = canvas?.parentElement
    if (!canvas || !frame) return
    const update = () => { layout.current = measureLayout(frame, canvas); invalidate() }
    update()
    const observer = new ResizeObserver(update)
    for (const el of [frame, canvas, ...frame.querySelectorAll('.diorama-callout,.diorama-focus,.diorama-focus-lane')]) observer.observe(el)
    frame.addEventListener('scroll', update, true)
    return () => { observer.disconnect(); frame.removeEventListener('scroll', update, true) }
  }, [view, hovered, selectedId, shown, invalidate])

  useFrame(({ camera, size }) => {
    const measured = layout.current
    if (!measured) return
    const { left, top, starts, lines, bubble } = measured
    const productKey = hovered?.endsWith(':shelf') || hovered?.endsWith(':pedestal')
      ? hovered : anchors.has(selectedId + ':shelf') ? selectedId + ':shelf' : selectedId + ':pedestal'
    camera.updateMatrixWorld()
    for (const [key, anchor] of anchors) {
      const marker = elements.get(key)
      const id = key === productKey ? 'product' : key
      const line = lines.get(id)
      if (!marker && !line && key !== hovered) continue
      const point = anchor.getWorldPosition(vector.current).project(camera)
      const px = (point.x * .5 + .5) * size.width
      const py = (.5 - point.y * .5) * size.height
      const visible = Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1 && Math.abs(point.z) <= 1
      if (marker) {
        marker.style.visibility = visible ? 'visible' : 'hidden'
        marker.style.transform = `translate3d(${Math.round(px)}px,${Math.round(py)}px,0) translate(-50%,-50%)`
      }
      const x = left + px, y = top + py
      if (key === hovered && bubble) {
        const rect = placeBubble(bubble, measured, corners, camera, vector.current, x, y)
        bubble.element.style.transform = `translate(${rect.x - bubble.left}px,${rect.y - bubble.top}px)`
        const endX = clamp(x, rect.x, rect.x + bubble.width)
        const endY = clamp(y, rect.y, rect.y + bubble.height)
        const focusLine = lines.get('focus')
        if (focusLine) drawLine(focusLine, { x: endX, y: endY, dx: 0, dy: 0 }, x, y, visible)
      }
      const start = starts.get(id)
      if (line && start) drawLine(line, start, x, y, visible)

    }
  })
  return null
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

function drawLine(line: Leader, start: Start, x: number, y: number, visible: boolean) {
  line.group.style.visibility = visible ? 'visible' : 'hidden'
  line.path.setAttribute('points', `${start.x},${start.y} ${start.x + 9 * start.dx},${start.y + 9 * start.dy} ${x},${y}`)
  line.dot.setAttribute('cx', String(x))
  line.dot.setAttribute('cy', String(y))
}

type Bubble = { element: HTMLElement; left: number; top: number; room: number; width: number; height: number }
type ViewRect = { left: number; top: number; width: number; height: number }

function placeBubble(bubble: Bubble, view: ViewRect, corners: Vector3[], camera: Camera, point: Vector3, x: number, y: number) {
  // Find the nearest empty side of the projected shop, including the enlarged meshes.
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity
  for (const corner of corners) {
    point.copy(corner).project(camera)
    const px = view.left + (point.x * .5 + .5) * view.width
    const py = view.top + (.5 - point.y * .5) * view.height
    left = Math.min(left, px); right = Math.max(right, px)
    top = Math.min(top, py); bottom = Math.max(bottom, py)
  }
  const { width, height } = bubble
  const gap = 12
  const minX = view.left + 4, maxX = view.left + view.width - width - 4
  const minY = view.top + 4, maxY = view.top + view.height - height - 4
  const nearX = clamp(x - width / 2, minX, maxX)
  const nearY = clamp(y - height / 2, minY, maxY)
  const candidates = [
    { x: nearX, y: top - gap - height }, { x: nearX, y: bottom + gap },
    { x: left - gap - width, y: nearY }, { x: right + gap, y: nearY },
  ]
  // A deep zoom may fill the canvas. The reserved top margin always remains clear.
  let best = { x: bubble.left + clamp(x - width / 2 - bubble.left, 0, bubble.room), y: bubble.top }
  let distance = Infinity
  for (const rect of candidates) {
    if (rect.x < minX || rect.x > maxX || rect.y < minY || rect.y > maxY) continue
    const d = Math.hypot(x - clamp(x, rect.x, rect.x + width), y - clamp(y, rect.y, rect.y + height))
    if (d < distance) { best = rect; distance = d }
  }
  return best
}

// Read label rectangles on layout changes only. Orbit and hover frames project the 3D pins.
function measureLayout(frame: HTMLElement, view: HTMLElement) {
  const box = frame.getBoundingClientRect(), canvas = view.getBoundingClientRect()
  const left = canvas.left - box.left, top = canvas.top - box.top
  const starts = new Map<string, Start>()
  for (const label of frame.querySelectorAll<HTMLButtonElement>('.diorama-callout[data-zone]')) {
    const rect = label.getBoundingClientRect()
    const rail = label.parentElement!.getBoundingClientRect()
    if (!rect.width || !rect.height || rect.bottom < rail.top || rect.top > rail.bottom) {
      const line = frame.querySelector<SVGGElement>(`[data-line="${label.dataset.zone}"]`)
      if (line) line.style.visibility = 'hidden'
      continue
    }
    const above = rect.bottom <= canvas.top + 1, below = rect.top >= canvas.bottom - 1
    const dy = above ? 1 : below ? -1 : 0
    const dx = dy ? 0 : rect.right <= canvas.left + 1 ? 1 : -1
    starts.set(label.dataset.zone!, {
      x: rect.left - box.left + rect.width * (1 + dx) / 2,
      y: rect.top - box.top + rect.height * (1 + dy) / 2, dx, dy,
    })
  }
  const lines = new Map<string, Leader>()
  for (const group of frame.querySelectorAll<SVGGElement>('[data-line]')) {
    const path = group.querySelector('polyline'), dot = group.querySelector('circle')
    if (path && dot) lines.set(group.dataset.line!, { group, path, dot })
  }
  const element = frame.querySelector<HTMLElement>('.diorama-focus')
  const lane = element?.parentElement?.getBoundingClientRect()
  const rect = element?.getBoundingClientRect()
  const bubble = element && lane && rect ? { element, left: lane.left - box.left, width: rect.width, height: rect.height,
    room: lane.width - rect.width, top: lane.top - box.top + (lane.height - rect.height) / 2 } : null
  return { left, top, width: canvas.width, height: canvas.height, starts, lines, bubble }
}
