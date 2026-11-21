import { useEffect, useMemo, type ReactNode } from 'react'
import { CanvasTexture, ExtrudeGeometry, MeshBasicMaterial, PlaneGeometry, Shape, SRGBColorSpace } from 'three'
import { Block, Collectible, Orb, Parcel, Ring, Round, materials, type MaterialName } from './models'
import { drawPackage } from './package-print'
import { workflowPositions, type Position, type SceneTarget, type SceneVariant } from './scene-model'

const windowProfile = new Shape()
windowProfile.moveTo(-.96, 0)
windowProfile.lineTo(-.96, 1.26)
windowProfile.absarc(0, 1.26, .96, Math.PI, 0, true)
windowProfile.lineTo(.96, 0)
windowProfile.closePath()
const serviceWindow = new ExtrudeGeometry(windowProfile, { depth: .065, bevelEnabled: false, curveSegments: 18 })

const printFace = new PlaneGeometry(1, 1)

function PrintedPanel({ name, format = 'label', width }: { name: string; format?: 'shop' | 'label' | 'package'; width: number }) {
  const material = useMemo(() => {
    const panel = document.createElement('canvas')
    panel.width = 640
    panel.height = format === 'package' ? 340 : 128
    const ctx = panel.getContext('2d')
    if (!ctx) return null
    if (format === 'package') {
      drawPackage(ctx, name)
    } else {
      const shop = format === 'shop'
      ctx.fillStyle = shop ? '#f0ece2' : '#292f37'
      ctx.fillRect(0, 0, 640, 128)
      ctx.fillStyle = shop ? '#c44232' : '#ed7255'
      ctx.fillRect(0, 0, 15, 128)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = shop ? 'bold 96px Arial' : 'bold 82px monospace'
      ctx.fillStyle = shop ? '#222b34' : '#fff9ec'
      ctx.fillText(name, 323, 69, 564)
    }
    const result = new CanvasTexture(panel)
    result.colorSpace = SRGBColorSpace
    result.anisotropy = 4
    return new MeshBasicMaterial({ map: result, toneMapped: false })
  }, [name, format])
  useEffect(() => () => {
    material?.map?.dispose()
    material?.dispose()
  }, [material])
  const height = width * (format === 'package' ? 340 / 640 : .2)
  return material && <mesh geometry={printFace} material={material} scale={[width, height, 1]}/>
}

function Architecture({ shopName }: { shopName?: string }) {
  return (
    <>
      <Block at={[0, -.50, .55]} size={[14.06, .44, 10.86]} material="graphite" />
      <Block at={[0, -.27, .55]} size={[13.94, .075, 10.75]} material="red" />
      <Block at={[0, -.14, .55]} size={[13.86, .23, 10.65]} material="stone" receive />
      <Block at={[3.96, -.001, .55]} size={[5.91, .058, 10.60]} material="clay" receive />
      {[-5.8, -4.1, -2.4, -.7].map(x => <Block key={x} at={[x, -.019, .54]} size={[.019, .012, 10.57]} material="seam" cast={false}/>)}
      {[-3.29, -1.6, .09, 1.78, 3.47, 5.16].map(z => <Block key={z} at={[-2.97, -.019, z]} size={[7.81, .012, .019]} material="seam" cast={false}/>)}
      <Block at={[1.02, .040, .54]} size={[.095, .017, 10.54]} material="paper" cast={false}/>
      <Block at={[6.12, .038, -.3]} size={[.055, .014, 5.75]} material="paper" cast={false}/>
      {[-1.7, -.8, .1, 1, 1.9].map(z => <Block key={z} at={[5.90, .042, z]} size={[.40, .011, .095]} material="paper" cast={false}/>)}
      <Block at={[0, 1.55, -4.47]} size={[13.77, 3.14, .37]} material="enamel" receive />
      <Block at={[-6.72, 1.55, -.62]} size={[.32, 3.14, 7.78]} material="enamel" receive />
      <Block at={[0, 3.18, -4.48]} size={[13.94, .14, .52]} material="graphite" />
      <Block at={[-6.73, 3.18, -.65]} size={[.51, .14, 7.84]} material="graphite" />
      <Block at={[0, 2.90, -4.24]} size={[13.84, .20, .047]} material="red" />
      <Block at={[-6.526, 2.90, -.65]} size={[.045, .20, 7.83]} material="red" />
      <Block at={[0, .15, -4.22]} size={[13.61, .27, .16]} material="graphite" />
      <Block at={[-6.51, .15, -.66]} size={[.15, .27, 7.51]} material="graphite" />
      {shopName && <group position={[-.70, 3.38, -4.11]}>
        <Block size={[4.35, .95, .17]} material="graphite" />
        <group position={[0, 0, .092]}><PrintedPanel name={shopName} format="shop" width={4.22}/></group>
      </group>}
    </>
  )
}

const packageColors: readonly MaterialName[] = ['red', 'blue', 'slate', 'carton']

function KitBox({ at, variant, index }: { at: Position; variant: SceneVariant; index: number }) {
  return <group position={at}>
    <Block size={[.79, .44, .39]} material={packageColors[index % packageColors.length]} receive/>
    <group position={[0, 0, .199]}><PrintedPanel name={variant.sku} format="package" width={.774}/></group>
  </group>
}

function Cabinet({ children, at, angle = 0, window, variants, start }: {
  children: ReactNode; at: Position; angle?: number; window: boolean; variants: readonly SceneVariant[]; start: number
}) {
  return <group position={at} rotation={[0, angle, 0]}>
    {window ? <group position={[0, .54, -.27]}>
      <mesh geometry={serviceWindow} material={materials.graphite} castShadow/>
      <mesh position={[0, .055, .069]} scale={[.90,.93,1]} geometry={serviceWindow} material={materials.window} receiveShadow/>
      <Block at={[0, 1.02, .16]} size={[.042, 1.87, .033]} material="slate" cast={false}/>
      <Block at={[0, 1.34, .16]} size={[1.73, .042, .033]} material="slate" cast={false}/>
    </group> : <group position={[0, 1.62, -.18]}>
      <Block size={[2.14, 2.11, .078]} material="graphite"/>
      <Block at={[0, -.008, .049]} size={[2.04, 1.99, .017]} material="pegboard" receive/>
    </group>}
    <Block at={[0, .34, .025]} size={[2.08, .68, .68]} material="slate" />
    <Block at={[0, .69, .033]} size={[2.17, .09, .78]} material="paleWood" receive />
    {[-.52, .52].map(x => <group key={x}>
      <Block at={[x, .35, .380]} size={[.96, .52, .033]} material="enamel" />
      <Block at={[x, .49, .408]} size={[.30, .040, .059]} material="graphite" cast={false}/>
    </group>)}
    <Block at={[0, 1.65, .045]} size={[2.19, .081, .70]} material="paleWood" receive/>
    <Block at={[0, 1.63, .398]} size={[2.19, .052, .035]} material="graphite" cast={false}/>
    <Block at={[0, 1.608, .373]} size={[1.78, .036, .047]} material="warmWhite" cast={false}/>
    {[-1.03, 1.03].map(x => <Block key={x} at={[x, 1.54, -.012]} size={[.063, 2.19, .097]} material="graphite"/>)}
    {variants.map((variant, i) => <KitBox key={variant.id} variant={variant} index={start + i} at={[i ? .49 : -.49, 1.91, .01]}/>)}
    {children}
  </group>
}

const cabinetPositions: { at: Position; angle?: number }[] = [
  { at: [-4.85, 0, -3.94] }, { at: [-2.36, 0, -3.94] }, { at: [.13, 0, -3.94] }, { at: [2.62, 0, -3.94] },
  { at: [-6.15, 0, -2.74], angle: Math.PI / 2 }, { at: [-6.15, 0, -.22], angle: Math.PI / 2 },
  { at: [-6.15, 0, 2.30], angle: Math.PI / 2 },
]
const cabinetSlots: Position[] = [[-.49, .749, .105], [.49, .749, .105]]

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
      <Block at={[width * .25, height * .51, .073]} size={[width * .24, height * .49, .017]} material="slate" cast={false} />
      <Block at={[width * .25, height * .52, .088]} size={[width * .10, .035, .020]} material="screenMint" rotation={[0, 0, .50]} cast={false} />
      {!wide && <Block at={[0, .035, 0]} size={[.185, .09, .105]} material="steel" />}
    </group>
  )
}

function Table({ at, size, color = 'wood', children }: {
  at: Position; size: [width: number, depth: number]; color?: 'wood' | 'graphite'; children?: ReactNode
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
      <Block at={[-.38, .607, 0]} size={[1.42, .73, .88]} material="paper" />
      <Block at={[-.38, .997, 0]} size={[1.53, .085, .94]} material="red" />
      <Block at={[.64, .478, 0]} size={[.65, .49, .84]} material="cream" />
      <Block at={[.48, .73, 0]} size={[.46, .305, .79]} material="cream" />
      <Block at={[.515, .74, .401]} size={[.32, .202, .032]} material="black" />
      <Block at={[.739, .735, -.03]} size={[.032, .210, .68]} rotation={[0, 0, .29]} material="steel" />
      <Block at={[.971, .35, 0]} size={[.05, .125, .92]} material="steel" />
      <Block at={[-1.097, .29, 0]} size={[.087, .091, .92]} material="rubber" />
      <Block at={[-.38, .606, .459]} size={[1.37, .16, .028]} material="red" cast={false} />
      <Block at={[-.78, .595, .480]} size={[.11, .203, .020]} rotation={[0,0,-.31]} material="paper" cast={false} />
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
      <Round at={[0, .34, 0]} size={[.175, .025, .175]} material="graphite" />
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
        <Cabinet key={cabinet} at={at} angle={angle} start={cabinet * 2} window={cabinet === 0 || cabinet === 1 || cabinet === 6} variants={shelfVariants.slice(cabinet * 2, cabinet * 2 + 2)}>
          {shelfVariants.slice(cabinet * 2, cabinet * 2 + 2).map((variant, slot) => {
            const shelfAt = cabinetSlots[slot]
            return (
              <group key={variant.id} position={shelfAt}>
                <Location target={{ zone: 'product', variant }} at={[.21, .077, .285]} shelf mesh={
                  <>
                    <Round at={[0, .012, 0]} size={[.219, .031, .206]} material={selected?.id === variant.id ? 'gold' : 'brass'} />
                    <Collectible sku={variant.sku} scale={.80} />
                  </>
                } />
              </group>
            )
          })}
        </Cabinet>
      ))}

      <group position={[-1.28, .018, 1.24]} rotation={[0, .19, 0]}>
        <Block at={[0, .085, 0]} size={[3.20, .17, 2.47]} material="graphite" receive/>
        <Block at={[0, .33, 0]} size={[2.94, .34, 2.23]} material="red" receive/>
        <Block at={[0, .51, 0]} size={[3.08, .10, 2.33]} material="paper" receive/>
        <Round at={[0, .604, 0]} size={[1.18, .087, .97]} material="graphite" receive/>
        <Round at={[0, .665, 0]} size={[1.11, .050, .915]} material="enamel" receive/>
        <Ring at={[0, 1.82, -.607]} size={[1.055, 1.055, .63]} material="steel"/>
        <Ring at={[0, 1.82, -.58]} size={[1.012, 1.012, .53]} material="gold"/>
        <Block at={[-.83, .84, -.60]} size={[.077, .68, .087]} material="slate"/>
        <Block at={[.83, .84, -.60]} size={[.077, .68, .087]} material="slate"/>
        {selected && <>
          <group position={[0, .33, 1.13]}><PrintedPanel name={selected.sku} width={1.25}/></group>
          <Location target={{ zone: 'product', variant: selected }} at={[.08, .43, 1.23]} mesh={
            <group position={[0, .702, .025]} rotation={[0, .29, 0]}><Collectible sku={selected.sku} scale={2.40}/></group>
          } />
        </>}
      </group>

      <Location target={{ zone: 'picking' }} at={workflowPositions.picking} mesh={
        <Table at={[-3.96, .005, .35]} size={[1.82, .79]} color="graphite">
          <Block at={[-.26, .949, 0]} size={[.54, .067, .43]} material="black" />
          <Block at={[-.24, .991, .029]} size={[.43, .02, .34]} material="paper" />
          <Block at={[-.26, 1.012, .060]} size={[.33, .014, .026]} material="steel" cast={false} />
          <Parcel at={[.49, .94, -.03]} size={[.48, .41, .43]} />
        </Table>
      } />
      <Location target={{ zone: 'packing' }} at={workflowPositions.packing} mesh={
        <Table at={[3.04, .005, -.26]} size={[2.20, .93]}>
          <Parcel at={[-.54, .935, .028]} size={[.62, .45, .58]} />
          <Block at={[-.27, .942, .028]} size={[1.14, .012, .74]} material="slate" cast={false}/>
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
          {[-.56, .56].map(x => <Block key={x} at={[x, .52, .32]} size={[.097, 1.032, .091]} material="graphite" />)}
          <Parcel at={[.04, .585, .002]} size={[.69, .39, .55]} />
          <Parcel at={[-.14, .16, .03]} size={[.55, .34, .49]} />
        </group>
      } />
      <Location target={{ zone: 'cashier' }} at={workflowPositions.cashier} mesh={
        <group position={[-4.65, .006, 2.95]} rotation={[0, -.16, 0]}>
          <Block at={[0, .443, 0]} size={[2.00, .87, .79]} material="wood" />
          <Block at={[0, .93, 0]} size={[2.13, .17, .89]} material="paleStone" receive />
          <Block at={[0, .46, .411]} size={[1.76, .61, .06]} material="graphite" />
          <Block at={[0, .64, .453]} size={[1.73, .12, .027]} material="red" cast={false}/>
          <Block at={[-.49, .36, .45]} size={[.50, .15, .034]} material="enamel" cast={false}/>
          <Monitor at={[-.55, 1.016, .02]} />
          <Block at={[.52, 1.071, .08]} size={[.50, .11, .28]} material="paper" />
          <Block at={[.53, 1.138, .108]} size={[.29, .025, .032]} material="slate" cast={false} />
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
          <Table at={[0, .004, 0]} size={[1.70, .81]} color="graphite">
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
          <Block key={x} at={[x, .472, 0]} size={[.63, .12, .61]} material="slate" />
        )}
        {[-.73, .73].map(x => <Block key={x} at={[x, .161, 0]} size={[.075, .31, .41]} material="steel" />)}
      </group>
      <Plant at={[-6.13, .004, 3.86]} scale={1.28} />
      <Plant at={[.47, .008, 4.63]} scale={1.14} />
      <Block at={[4.88, .018, 3.95]} size={[2.77, .015, .046]} material="tape" cast={false} />
      <Block at={[6.29, .018, 4.79]} size={[.048, .015, 1.67]} material="tape" cast={false} />
      <Block at={[3.51, .018, 4.79]} size={[.048, .015, 1.67]} material="tape" cast={false} />
    </group>
  )
}
