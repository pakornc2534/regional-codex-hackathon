import { useEffect, useMemo, type ReactNode } from 'react'
import { Box3, Group, Mesh, MeshBasicMaterial, Vector3 } from 'three'
import { buildGallery } from './gallery-model'
import { HoverHighlight, hoverScale } from './HoverHighlight'
import { workflowZones, type SceneTarget, type SceneVariant } from './scene-model'

export interface HoveredLocation {
  key: string
  copy: number
}

export interface LocationProps {
  target: SceneTarget
  parts: ReturnType<typeof location>[]
  shelf?: boolean
}

function location(part: Group, pin: Group, subject = part) {
  const mesh = new Group()
  mesh.attach(part)
  const bounds = new Box3().setFromObject(subject)
  const pivot = new Group()
  bounds.getCenter(pivot.position)
  pivot.position.y = bounds.min.y
  mesh.add(pivot)
  pivot.attach(subject)
  return { mesh, pin, pivot, size: bounds.getSize(new Vector3()) }
}

function prepareModel(ids: string[], selectedId: string | undefined, shopName: string) {
  const index = selectedId === undefined ? -1 : ids.indexOf(selectedId)
  const { root, shelves, stations, pedestal, pedestalPin, hero } = buildGallery(ids, index, shopName)
  const meshes: Mesh[] = []
  root.traverse(object => { if (object instanceof Mesh) meshes.push(object) })
  root.updateMatrixWorld(true)

  // The computer sits on the cashier's desk but has its own hit target and pivot.
  const computer = location(stations.computer.part, stations.computer.pin)
  const work = workflowZones.map(zone => ({
    key: zone, zone, parts: [zone === 'computer' ? computer : location(stations[zone].part, stations[zone].pin)],
  }))
  const products = [...shelves].map(([id, copies]) => ({
    key: id + ':shelf', id, shelf: true, parts: copies.map(({ part, pin }) => location(part, pin)),
  }))
  if (hero && selectedId) products.push({
    key: selectedId + ':pedestal', id: selectedId, shelf: false, parts: [location(pedestal, pedestalPin, hero)],
  })
  const locations = [...work, ...products]
  const parts = locations.flatMap(entry => entry.parts)
  const bounds = new Box3().setFromObject(root)
  for (const { mesh, pivot, size } of parts) {
    bounds.expandByObject(mesh)
    const base = pivot.position
    bounds.expandByPoint(new Vector3(base.x - size.x * hoverScale / 2, base.y, base.z - size.z * hoverScale / 2))
    bounds.expandByPoint(new Vector3(base.x + size.x * hoverScale / 2, base.y + size.y * hoverScale, base.z + size.z * hoverScale / 2))
  }
  const corners = [bounds.min.x, bounds.max.x].flatMap(x => [bounds.min.y, bounds.max.y].flatMap(y =>
    [bounds.min.z, bounds.max.z].map(z => new Vector3(x, y, z))))

  // R3F leaves primitive resources with their owner. Color materials are
  // shared by all gallery instances; the sign material and texture are per store.
  function dispose() {
    for (const mesh of meshes) {
      mesh.geometry.dispose()
      if (mesh.material instanceof MeshBasicMaterial && mesh.material.map) {
        mesh.material.map.dispose()
        mesh.material.dispose()
      }
    }
  }
  return { root, locations, parts, corners, dispose }
}

export function Diorama({ variants, selected, hover, markers, shopName = '', location: Location }: {
  shopName?: string
  variants: readonly SceneVariant[]
  selected?: SceneVariant
  hover: HoveredLocation | null
  markers: (corners: Vector3[]) => ReactNode
  location: (props: LocationProps) => ReactNode
}) {
  // Stock and labels can refresh without changing the meshes.
  const ids = JSON.stringify(variants.map(variant => variant.id))
  const selectedId = selected?.id
  const model = useMemo(() => prepareModel(JSON.parse(ids), selectedId, shopName), [ids, selectedId, shopName])
  useEffect(() => model.dispose, [model])
  const variantsById = new Map(variants.map(variant => [variant.id, variant]))
  const focused = hover ? model.locations.find(entry => entry.key === hover.key)?.parts[hover.copy] : undefined

  return (
    <group>
      <primitive object={model.root} />
      {model.locations.map(entry => {
        if ('zone' in entry) return <Location key={entry.key} target={{ zone: entry.zone }} parts={entry.parts} />
        const variant = variantsById.get(entry.id)
        return variant && <Location key={entry.key} target={{ zone: 'product', variant }} shelf={entry.shelf} parts={entry.parts} />
      })}
      <HoverHighlight parts={model.parts} focused={focused} />
      {markers(model.corners)}
    </group>
  )
}
