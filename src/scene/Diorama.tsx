import { useEffect, useMemo, type ReactNode } from 'react'
import { Group, Mesh, MeshBasicMaterial, Vector3, type Object3D } from 'three'
import { buildGallery } from './gallery-model'
import { workflowZones, type Position, type SceneTarget, type SceneVariant } from './scene-model'

export interface LocationProps {
  target: SceneTarget
  at: Position
  mesh: ReactNode
  shelf?: boolean
}

// Keep world-space transforms when handing each set of meshes to the viewer's
// existing Location component. The register and the computer have separate targets.
function location(parts: Group[], pin: Object3D) {
  const at: Position = pin.getWorldPosition(new Vector3()).toArray()
  const group = new Group()
  for (const part of parts) group.attach(part)
  return { at, mesh: <primitive object={group} /> }
}

function prepareModel(ids: string[], selectedId: string | undefined, shopName: string) {
  const index = selectedId === undefined ? -1 : ids.indexOf(selectedId)
  const { root, shelves, stations, pedestal, pedestalPin } = buildGallery(ids, index, shopName)
  const meshes: Mesh[] = []
  root.traverse(object => { if (object instanceof Mesh) meshes.push(object) })
  root.updateMatrixWorld(true)

  const work = workflowZones.map(zone => ({
    zone,
    location: location([stations[zone].part], stations[zone].pin),
  }))
  const products = [...shelves].map(([id, { parts, pin }]) => ({
    id, location: location(parts, pin),
  }))
  const featured = index >= 0 ? location([pedestal], pedestalPin) : undefined

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
  return { root, work, products, featured, dispose }
}

export function Diorama({ variants, selected, shopName = '', location: Location }: {
  shopName?: string
  variants: readonly SceneVariant[]
  selected?: SceneVariant
  location: (props: LocationProps) => ReactNode
}) {
  // Stock and labels can refresh without changing the meshes.
  const ids = JSON.stringify(variants.map(variant => variant.id))
  const selectedId = selected?.id
  const model = useMemo(() => prepareModel(JSON.parse(ids), selectedId, shopName), [ids, selectedId, shopName])
  useEffect(() => model.dispose, [model])
  const variantsById = new Map(variants.map(variant => [variant.id, variant]))

  return (
    <group dispose={null}>
      <primitive object={model.root} />
      {model.work.map(({ zone, location }) =>
        <Location key={zone} target={{ zone }} {...location} />)}
      {model.products.map(({ id, location }) => {
        const variant = variantsById.get(id)
        return variant && <Location key={id} target={{ zone: 'product', variant }} shelf {...location} />
      })}
      {selected && model.featured &&
        <Location key={`pedestal:${selected.id}`} target={{ zone: 'product', variant: selected }} {...model.featured} />}
    </group>
  )
}
