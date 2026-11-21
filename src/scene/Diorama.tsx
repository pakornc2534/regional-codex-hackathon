import { useEffect, useMemo, type ReactNode } from 'react'
import { CanvasTexture, CylinderGeometry, ExtrudeGeometry, LinearFilter, Shape, SRGBColorSpace } from 'three'
import { Block, Collectible, Orb, Parcel, Ring, Round, materials } from './models'
import { workflowPositions, type Position, type SceneTarget, type SceneVariant } from './scene-model'

const archOutline = (radius: number, spring: number) => {
  const shape = new Shape()
  shape.moveTo(-radius, 0)
  shape.lineTo(-radius, spring)
  shape.absarc(0, spring, radius, Math.PI, 0, true)
  shape.lineTo(radius, 0)
  shape.closePath()
  return shape
}

const archPanel = new ExtrudeGeometry(archOutline(.95, 1.48), { depth: .075, bevelEnabled: false, curveSegments: 24 })
const brassArch = new ExtrudeGeometry(archOutline(1.06, 1.48), {
  depth: .08, bevelEnabled: true, bevelSize: .018, bevelThickness: .018, bevelSegments: 1, curveSegments: 24,
})
const limestoneArch = new ExtrudeGeometry(archOutline(1.16, 1.50), {
  depth: .07, bevelEnabled: true, bevelSize: .025, bevelThickness: .023, bevelSegments: 1, curveSegments: 24,
})

// The ribs are one mesh. The brass cap and base catch the light as the camera turns.
const flutedDrum = new CylinderGeometry(1, 1, 1, 128)
const ribs = flutedDrum.getAttribute('position')
for (let i = 0; i < ribs.count; i += 1) {
  const x = ribs.getX(i), z = ribs.getZ(i)
  const flute = .97 + .03 * Math.cos(32 * Math.atan2(z, x))
  ribs.setXYZ(i, x * flute, ribs.getY(i), z * flute)
}
flutedDrum.computeVertexNormals()

function ShopSign({ name }: { name: string }) {
  const texture = useMemo(() => {
    const panel = document.createElement('canvas')
    panel.width = 640
    panel.height = 120
    const ctx = panel.getContext('2d')
    if (!ctx) return null
    ctx.fillStyle = '#143d37'
    ctx.fillRect(0, 0, panel.width, panel.height)
    ctx.strokeStyle = '#cbae70'
    ctx.lineWidth = 3
    ctx.strokeRect(7, 7, 626, 106)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = '600 76px Georgia, serif'
    ctx.fillStyle = '#ffe7b0'
    ctx.fillText(name, 320, 61, 590)
    const result = new CanvasTexture(panel)
    result.colorSpace = SRGBColorSpace
    result.minFilter = LinearFilter
    return result
  }, [name])
  useEffect(() => () => texture?.dispose(), [texture])
  return (
    <group position={[-1.03, 3.383, -4.08]}>
      <Block size={[3.48, .72, .16]} material="brass" />
      {texture && <mesh position={[0, 0, .093]}><planeGeometry args={[3.40, .635]} /><meshBasicMaterial map={texture} toneMapped={false} /></mesh>}
    </group>
  )
}

function Arch({ at, rotation = 0 }: { at: Position; rotation?: number }) {
  return (
    <group position={at} rotation={[0, rotation, 0]}>
      <mesh geometry={limestoneArch} material={materials.ivory} castShadow receiveShadow />
      <mesh position={[0, .015, .103]} geometry={brassArch} material={materials.brass} castShadow />
      <mesh position={[0, .021, .193]} geometry={archPanel} material={materials.warmGlass} receiveShadow />
      <Block at={[0, 1.51, .37]} size={[1.58, .032, .033]} material="warmWhite" cast={false} />
      {[-2, -1, 0, 1, 2].map(i => (
        <Block key={i} at={[Math.sin(i * .37) * .56, 1.48 + Math.cos(i * .37) * .56, .284]} size={[.016, .69, .016]} rotation={[0, 0, -i * .37]} material="brass" cast={false} />
      ))}
      <Block at={[0, .017, .330]} size={[2.17, .13, .35]} material="paleWood" />
    </group>
  )
}

function Column({ at, height = 3.32 }: { at: Position; height?: number }) {
  return (
    <group position={at}>
      <Block at={[0, height / 2, 0]} size={[.29, height, .34]} material="ivory" receive />
      <Block at={[0, .13, .025]} size={[.41, .26, .45]} material="paleStone" />
      <Block at={[0, height - .14, .025]} size={[.42, .23, .47]} material="paleStone" />
      <Block at={[0, height + .01, 0]} size={[.47, .13, .51]} material="edge" />
      <Block at={[0, 1.69, .187]} size={[.036, 2.43, .023]} material="plaster" cast={false} />
    </group>
  )
}

function Architecture({ shopName }: { shopName?: string }) {
  return (
    <>
      <Block at={[0, -.63, .55]} size={[14.13, .25, 10.91]} material="foundation" />
      <Block at={[0, -.752, .55]} size={[14.00, .035, 10.78]} material="brass" />
      <Block at={[0, -.42, .55]} size={[13.86, .20, 10.64]} material="edge" />
      <Block at={[0, -.22, .55]} size={[13.78, .25, 10.60]} material="stone" receive />
      <Block at={[3.93, -.071, .89]} size={[5.88, .152, 9.95]} material="clay" receive />
      <Block at={[-2.93, -.054, .55]} size={[7.94, .095, 10.54]} material="stone" receive />
      <Block at={[.975, -.012, .51]} size={[.053, .015, 9.74]} material="brass" cast={false} />
      <Block at={[3.94, -.021, 5.85]} size={[5.80, .121, .059]} material="shadeClay" cast={false} />
      {Array.from({ length: 7 }, (_, index) => (
        <Block key={index} at={[-2.95, -.004, -3.75 + index * 1.43]} size={[7.79, .006, .015]} material="seam" cast={false} />
      ))}
      {[-6.03, -4.9, -3.74, -2.57, -1.42, -.26].map(x => (
        <Block key={x} at={[x, -.004, .5]} size={[.016, .006, 10.43]} material="seam" cast={false} />
      ))}
      {[-3.24, -1.69, -.14, 1.42, 2.98, 4.52].map(z => (
        <Block key={z} at={[3.94, .007, z]} size={[5.82, .009, .014]} material="shadeClay" cast={false} />
      ))}
      {[2.36, 3.86, 5.36].map(x => (
        <Block key={x} at={[x, .007, .87]} size={[.015, .010, 9.83]} material="shadeClay" cast={false} />
      ))}

      <Block at={[-3.02, .0015, 5.35]} size={[6.72, .008, .038]} material="brass" cast={false} />
      <Block at={[-6.35, .0015, 1.12]} size={[.038, .008, 8.49]} material="brass" cast={false} />
      <Block at={[.315, .0015, 3.60]} size={[.038, .008, 3.55]} material="brass" cast={false} />

      <Block at={[0, 1.58, -4.45]} size={[13.66, 3.15, .43]} material="plaster" receive />
      <Block at={[-6.67, 1.56, -.65]} size={[.40, 3.10, 7.50]} material="plaster" receive />
      <Block at={[0, 3.20, -4.44]} size={[13.9, .15, .63]} material="darkGreen" />
      <Block at={[-6.68, 3.20, -.67]} size={[.61, .15, 7.67]} material="darkGreen" />
      <Block at={[0, 3.343, -4.49]} size={[14.05, .159, .64]} material="darkGreen" />
      <Block at={[-6.75, 3.343, -.64]} size={[.64, .159, 7.69]} material="darkGreen" />
      <Block at={[0, .13, -4.18]} size={[13.56, .22, .16]} material="wood" />
      <Block at={[-6.44, .13, -.65]} size={[.16, .22, 7.48]} material="wood" />
      <Block at={[.12, 2.96, -4.209]} size={[13.19, .035, .019]} material="brass" cast={false} />
      {shopName && <ShopSign name={shopName} />}
      <Block at={[0, 3.34, -4.16]} size={[13.94, .033, .025]} material="brass" />
      <Block at={[-6.435, 3.34, -.65]} size={[.023, .033, 7.62]} material="brass" />
      {[-4.78, -2.28, .22, 2.72].map(x => <Arch key={x} at={[x, .35, -4.13]} />)}
      {[-5.99, -3.54, -1.04, 1.46, 3.96, 6.51].map(x => <Column key={x} at={[x, .01, -4.119]} />)}

      {[-2.78, -.29, 2.19].map(z => <Arch key={z} at={[-6.41, .31, z]} rotation={Math.PI / 2} />)}
      {[-3.99, -1.53, .96, 3.46].map(z => <Column key={z} at={[-6.42, 0, z]} />)}
      <Block at={[-6.44, .615, 3.30]} size={[.30, 1.24, .36]} material="ivory" />
      <Block at={[6.86, .438, -3.23]} size={[.22, .845, 2.13]} material="shadeClay" />
      <Block at={[6.87, .878, -3.24]} size={[.31, .11, 2.15]} material="ivory" />
    </>
  )
}

function DisplayCabinet({ children, at, angle = 0 }: { children: ReactNode; at: Position; angle?: number }) {
  return (
    <group position={at} rotation={[0, angle, 0]}>
      <Block at={[0, .258, 0]} size={[1.88, .48, .61]} material="darkGreen" cast />
      <Block at={[0, .49, .027]} size={[1.99, .11, .71]} material="brass" receive />
      <Block at={[-.49, .654, .02]} size={[.81, .23, .53]} material="wood" />
      <Block at={[-.49, .781, .02]} size={[.84, .034, .55]} material="paleStone" />
      {[-1, 1].map(side => (
        <group key={side}>
          <Block at={[side * .45, .294, .317]} size={[.65, .21, .02]} material="teal" cast={false} />
          <Block at={[side * .45, .299, .337]} size={[.14, .021, .02]} material="brass" cast={false} />
        </group>
      ))}
      <Block at={[0, .561, .34]} size={[1.87, .050, .048]} material="brass" />
      {children}
    </group>
  )
}

const cabinetPositions: { at: Position; angle?: number }[] = [
  { at: [-4.78, 0, -3.945] },
  { at: [-2.28, 0, -3.945] },
  { at: [.22, 0, -3.945] },
  { at: [2.72, 0, -3.945] },
  { at: [-6.10, 0, -2.78], angle: Math.PI / 2 },
  { at: [-6.10, 0, -.29], angle: Math.PI / 2 },
  { at: [-6.10, 0, 2.19], angle: Math.PI / 2 },
]
const cabinetSlots: Position[] = [[-.50, .805, .05], [.48, .555, .05]]

function Monitor({ at, wide = false }: { at: Position; wide?: boolean }) {
  const width = wide ? 1.48 : .79
  const height = wide ? .86 : .47
  return (
    <group position={at}>
      <Block at={[0, height * .60, 0]} size={[width + .09, height + .09, .105]} material="black" />
      <Block at={[0, height * .60, .057]} size={[width, height, .023]} material="screen" cast={false} />
      <Block at={[-width * .18, height * .85, .075]} size={[width * .48, .028, .016]} material="screenMint" cast={false} />
      <Block at={[-width * .21, height * .70, .075]} size={[width * .42, .023, .016]} material="screenMint" cast={false} />
      <Block at={[-width * .26, height * .55, .075]} size={[width * .32, .023, .016]} material="screenGold" cast={false} />
      <Block at={[width * .25, height * .51, .073]} size={[width * .24, height * .49, .017]} material="teal" cast={false} />
      <Block at={[width * .25, height * .52, .088]} size={[width * .10, .035, .020]} material="screenMint" rotation={[0, 0, .50]} cast={false} />
      {!wide && <Block at={[0, .035, 0]} size={[.185, .09, .105]} material="steel" />}
    </group>
  )
}

function Table({ at, size, color = 'wood', children }: {
  at: Position; size: [width: number, depth: number]; color?: 'wood' | 'darkGreen'; children?: ReactNode
}) {
  const [width, depth] = size
  return (
    <group position={at}>
      <Block at={[0, .87, 0]} size={[width, .13, depth]} material="paleWood" receive />
      <Block at={[0, .733, 0]} size={[width - .14, .165, depth - .16]} material={color} />
      {[-1, 1].map(side => [-1, 1].map(face => (
        <Block key={`${side}:${face}`} at={[side * (width / 2 - .14), .38, face * (depth / 2 - .13)]} size={[.12, .76, .12]} material={color} />
      )))}
      {children}
    </group>
  )
}

function CarrierVan() {
  return (
    <group position={[5.17, .02, 4.93]} rotation={[0, -.21, 0]}>
      <Block at={[-.38, .607, 0]} size={[1.42, .73, .88]} material="darkGreen" />
      <Block at={[-.38, .997, 0]} size={[1.53, .085, .94]} material="teal" />
      <Block at={[.64, .478, 0]} size={[.65, .49, .84]} material="cream" />
      <Block at={[.48, .73, 0]} size={[.46, .305, .79]} material="cream" />
      <Block at={[.515, .74, .401]} size={[.32, .202, .032]} material="black" />
      <Block at={[.739, .735, -.03]} size={[.032, .210, .68]} rotation={[0, 0, .29]} material="steel" />
      <Block at={[.971, .35, 0]} size={[.05, .125, .92]} material="steel" />
      <Block at={[-1.097, .29, 0]} size={[.087, .091, .92]} material="rubber" />
      <Block at={[-.38, .646, .459]} size={[.61, .049, .028]} material="gold" cast={false} />
      <Block at={[-.455, .547, .459]} size={[.45, .035, .028]} material="paper" cast={false} />
      {[-.65, .65].map(x => [-.43, .43].map(z => (
        <group key={`${x}:${z}`}>
          <Round at={[x, .196, z]} size={[.207, .117, .207]} material="rubber" rotation={[Math.PI / 2, 0, 0]} />
          <Round at={[x, .196, z * 1.16]} size={[.093, .021, .093]} material="steel" rotation={[Math.PI / 2, 0, 0]} />
        </group>
      )))}
      {[-.31, .31].map(z => (
        <Block key={z} at={[.975, .493, z]} size={[.046, .105, .164]} material="warmWhite" />
      ))}
    </group>
  )
}

function Plant({ at, scale = 1 }: { at: Position; scale?: number }) {
  return (
    <group position={at} scale={scale}>
      <Round at={[0, .16, 0]} size={[.202, .30, .202]} material="shadeClay" />
      <Round at={[0, .309, 0]} size={[.224, .058, .224]} material="clay" />
      <Round at={[0, .34, 0]} size={[.175, .025, .175]} material="archPanel" />
      {[-2, -1, 0, 1, 2].map((index) => (
        <Orb key={index} at={[index * .105, .53 + (2 - Math.abs(index)) * .075, index % 2 * .085]} size={[.082, .26, .072]} rotation={[.25, index * .7, -index * .36]} material={index % 2 ? 'teal' : 'moss'} />
      ))}
    </group>
  )
}

export interface LocationProps {
  target: SceneTarget
  at: Position
  mesh: ReactNode
  shelf?: boolean
}

export function Diorama({ variants, selected, shopName, location: Location }: {
  shopName?: string
  variants: readonly SceneVariant[]
  selected?: SceneVariant
  location: (props: LocationProps) => ReactNode
}) {
  const shelfVariants = variants.slice(0, 13)
  return (
    <group dispose={null}>
      <Architecture shopName={shopName} />
      {cabinetPositions.map(({ at, angle }, cabinet) => (
        <DisplayCabinet key={cabinet} at={at} angle={angle}>
          {shelfVariants.slice(cabinet * 2, cabinet * 2 + 2).map((variant, slot) => {
            const shelfAt = cabinetSlots[slot]
            return (
              <group key={variant.id} position={shelfAt}>
                <Location target={{ zone: 'product', variant }} at={[.21, .077, .285]} shelf mesh={
                  <>
                    <Round at={[0, .012, 0]} size={[.219, .031, .206]} material={selected?.id === variant.id ? 'gold' : 'brass'} />
                    <Collectible sku={variant.sku} scale={.87} />
                  </>
                } />
              </group>
            )
          })}
        </DisplayCabinet>
      ))}

      <group position={[-.96, .013, 1.19]} rotation={[0, .19, 0]}>
        <Round at={[0, .035, 0]} size={[1.66, .065, 1.30]} material="darkGreen" receive />
        <Round at={[0, .086, 0]} size={[1.60, .044, 1.24]} material="brass" />
        <Round at={[0, .142, 0]} size={[1.49, .085, 1.16]} material="paleStone" receive />
        <mesh position={[0, .439, 0]} scale={[1.08, .51, .90]} geometry={flutedDrum} material={materials.teal} castShadow receiveShadow />
        <Round at={[0, .213, 0]} size={[1.12, .049, .94]} material="brass" />
        <Round at={[0, .704, 0]} size={[1.13, .074, .95]} material="brass" />
        <Round at={[0, .757, 0]} size={[1.07, .043, .89]} material="paleStone" receive />
        <Ring at={[0, 1.64, -.515]} size={[1.02, 1.02, .54]} material="gold" />
        <Ring at={[0, 1.64, -.548]} size={[1.093, 1.093, .64]} material="brass" />
        <Block at={[-.75, .871, -.52]} size={[.093, .34, .09]} material="brass" />
        <Block at={[.75, .871, -.52]} size={[.093, .34, .09]} material="brass" />
        {selected && (
          <Location target={{ zone: 'product', variant: selected }} at={[.08, .37, 1.23]} mesh={
            <group position={[0, .785, .04]} rotation={[0, .16, 0]}><Collectible sku={selected.sku} scale={1.68} /></group>
          } />
        )}
      </group>

      <Location target={{ zone: 'picking' }} at={workflowPositions.picking} mesh={
        <Table at={[-3.96, .005, .35]} size={[1.82, .79]} color="darkGreen">
          <Block at={[-.26, .949, 0]} size={[.54, .067, .43]} material="black" />
          <Block at={[-.24, .991, .029]} size={[.43, .02, .34]} material="paper" />
          <Block at={[-.26, 1.012, .060]} size={[.33, .014, .026]} material="steel" cast={false} />
          <Parcel at={[.49, .94, -.03]} size={[.48, .41, .43]} />
        </Table>
      } />
      <Location target={{ zone: 'packing' }} at={workflowPositions.packing} mesh={
        <Table at={[3.04, .005, -.26]} size={[2.20, .93]}>
          <Parcel at={[-.54, .935, .028]} size={[.62, .45, .58]} />
          <Block at={[.64, .97, -.04]} size={[.57, .075, .46]} material="black" />
          <Block at={[.64, 1.09, -.12]} size={[.55, .19, .30]} material="steel" />
          <Block at={[.64, .99, .17]} size={[.35, .018, .24]} material="paper" />
          <Round at={[.039, 1.017, .14]} size={[.14, .15, .14]} material="tape" />
          <Parcel at={[.25, .08, -.028]} size={[.69, .37, .66]} />
        </Table>
      } />
      <Location target={{ zone: 'staging' }} at={workflowPositions.staging} mesh={
        <group position={[3.45, .009, 2.61]}>
          <Block at={[0, .065, 0]} size={[1.58, .14, 1.08]} material="wood" />
          {[-.36, 0, .36].map(z => <Block key={z} at={[0, .159, z]} size={[1.61, .076, .19]} material="paleWood" />)}
          <Parcel at={[-.36, .2, .17]} size={[.64, .43, .59]} />
          <Parcel at={[.37, .2, .01]} size={[.62, .54, .68]} />
          <Parcel at={[-.38, .63, .14]} size={[.44, .32, .44]} />
        </group>
      } />
      <Location target={{ zone: 'carrier' }} at={workflowPositions.carrier} mesh={<CarrierVan />} />
      <Location target={{ zone: 'returns' }} at={workflowPositions.returns} mesh={
        <group position={[5.43, .01, 1.15]}>
          <Block at={[0, .585, -.34]} size={[1.12, .97, .083]} material="ebony" />
          <Block at={[0, .53, 0]} size={[1.16, .10, .75]} material="paleWood" />
          <Block at={[0, .113, 0]} size={[1.16, .10, .75]} material="paleWood" />
          {[-.56, .56].map(x => <Block key={x} at={[x, .52, .32]} size={[.097, 1.032, .091]} material="darkGreen" />)}
          <Parcel at={[.04, .585, .002]} size={[.69, .39, .55]} />
          <Parcel at={[-.14, .16, .03]} size={[.55, .34, .49]} />
        </group>
      } />
      <Location target={{ zone: 'cashier' }} at={workflowPositions.cashier} mesh={
        <group position={[-4.65, .006, 2.95]} rotation={[0, -.16, 0]}>
          <Block at={[0, .443, 0]} size={[2.00, .87, .79]} material="wood" />
          <Block at={[0, .93, 0]} size={[2.13, .17, .89]} material="paleStone" receive />
          <Block at={[0, .46, .411]} size={[1.76, .61, .06]} material="darkGreen" />
          {[-.75, -.5, -.25, 0, .25, .5, .75].map(x => <Block key={x} at={[x, .46, .446]} size={[.036, .58, .032]} material="brass" cast={false} />)}
          <Monitor at={[-.55, 1.016, .02]} />
          <Block at={[.52, 1.071, .08]} size={[.50, .11, .28]} material="paper" />
          <Block at={[.53, 1.138, .108]} size={[.29, .025, .032]} material="teal" cast={false} />
        </group>
      } />
      <Location target={{ zone: 'insights' }} at={workflowPositions.insights} mesh={
        <group position={[5.20, 1.74, -4.01]}>
          <Block at={[0, .44, 0]} size={[2.15, 1.36, .14]} material="wood" />
          <Monitor at={[0, .015, .092]} wide />
          <Block at={[0, -.047, .107]} size={[2.03, .065, .126]} material="paleWood" />
          <Block at={[0, 1.169, .088]} size={[1.54, .046, .105]} material="warmWhite" />
        </group>
      } />
      <Location target={{ zone: 'computer' }} at={workflowPositions.computer} mesh={
        <group position={[5.23, 0, -2.09]} rotation={[0, -.18, 0]}>
          <Table at={[0, .004, 0]} size={[1.70, .81]} color="darkGreen">
            <Monitor at={[0, .935, -.074]} />
            <Block at={[0, .95, .223]} size={[.55, .035, .201]} material="black" />
            <Block at={[.45, .956, .192]} size={[.138, .046, .174]} material="steel" />
          </Table>
          <Round at={[.23, .426, .84]} size={[.27, .070, .27]} material="black" />
          <Round at={[.23, .22, .84]} size={[.087, .43, .087]} material="steel" />
          <Round at={[.23, .051, .84]} size={[.23, .06, .23]} material="rubber" />
        </group>
      } />

      <group position={[-2.91, .012, 4.23]} rotation={[0, .10, 0]}>
        <Block at={[0, .36, 0]} size={[1.91, .14, .54]} material="wood" />
        {[-.66, 0, .66].map(x =>
          <Block key={x} at={[x, .472, 0]} size={[.63, .12, .61]} material="teal" />
        )}
        {[-.73, .73].map(x => <Block key={x} at={[x, .161, 0]} size={[.075, .31, .41]} material="brass" />)}
      </group>
      <Plant at={[-6.13, .004, 3.86]} scale={1.28} />
      <Plant at={[.46, .005, -2.89]} />
      <Plant at={[6.26, .005, -2.94]} />
      <Plant at={[.47, .008, 4.63]} scale={1.14} />
      <Block at={[4.88, .018, 3.95]} size={[2.77, .015, .046]} material="tape" cast={false} />
      <Block at={[6.29, .018, 4.79]} size={[.048, .015, 1.67]} material="tape" cast={false} />
      <Block at={[3.51, .018, 4.79]} size={[.048, .015, 1.67]} material="tape" cast={false} />
    </group>
  )
}
