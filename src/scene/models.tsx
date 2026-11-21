import type { ReactNode } from 'react'
import { BoxGeometry, CylinderGeometry, DataTexture, ExtrudeGeometry, LinearFilter, MeshStandardMaterial, RepeatWrapping, Shape, SphereGeometry, TorusGeometry } from 'three'
import type { Position } from './scene-model'

const box = new BoxGeometry(1, 1, 1)
const cylinder = new CylinderGeometry(1, 1, 1, 32)
const sphere = new SphereGeometry(1, 16, 12)
const ring = new TorusGeometry(1, 0.045, 8, 48)

const standard = (color: string, roughness = .72, metalness = 0) =>
  new MeshStandardMaterial({ color, roughness, metalness })

const luminous = (color: string, intensity: number) =>
  new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: .45 })

// A shared, seamless grain keeps the cabinet faces and stonework legible in close-up.
function grain(wood: boolean) {
  const size = 96
  const pixels = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size * Math.PI * 2
      const v = y / size * Math.PI * 2
      const grainValue = wood
        ? Math.sin(7 * v + .6 * Math.sin(u) + .44 * Math.sin(2 * u)) * .6 + Math.sin(14 * v + Math.sin(u)) * .4
        : Math.cos(2 * u + Math.sin(3 * v) + .9 * Math.cos(v + u)) * Math.sin(5 * v + u)
      const shade = Math.round(238 + 13 * grainValue)
      const index = 4 * (y * size + x)
      pixels.set([shade, shade, shade, 255], index)
    }
  }
  const texture = new DataTexture(pixels, size, size)
  texture.magFilter = LinearFilter
  texture.minFilter = LinearFilter
  texture.wrapS = texture.wrapT = RepeatWrapping
  texture.needsUpdate = true
  return texture
}

const timberGrain = grain(true)
const stoneGrain = grain(false)
const timber = (color: string) => new MeshStandardMaterial({ color, map: timberGrain, roughness: .57 })
const mineral = (color: string) => new MeshStandardMaterial({ color, map: stoneGrain, roughness: .77 })

function perforatedEnamel() {
  // One texture per rack finish keeps the pegboard holes off the draw-call budget.
  const size = 96
  const pixels = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const hole = Math.hypot(x % 12 - 6, y % 12 - 6) < 1.7
      const i = 4 * (y * size + x)
      const tone = hole ? 130 : 241
      pixels.set([tone, tone, tone, 255], i)
    }
  }
  const map = new DataTexture(pixels, size, size)
  map.magFilter = map.minFilter = LinearFilter
  map.needsUpdate = true
  return new MeshStandardMaterial({ map, color: '#a8afb0', roughness: .78 })
}

export const materials = {
  graphite: standard('#29353d', .58),
  slate: standard('#556879', .52),
  enamel: standard('#d5dcda', .58),
  window: standard('#aac1c6', .39),
  pegboard: perforatedEnamel(),
  stone: mineral('#e0dbcc'),
  paleStone: mineral('#eee9dc'),
  seam: standard('#a7a8a1'),
  clay: mineral('#ca947c'),
  shadeClay: standard('#a46951'),
  wood: timber('#6e5344'),
  paleWood: timber('#c2a680'),
  ebony: standard('#383b39'),
  brass: standard('#bc9760', .37, .33),
  gold: luminous('#f7c46d', .40),
  warmWhite: luminous('#fff3d9', .6),
  screen: luminous('#344d57', .32),
  screenMint: luminous('#9ed9bd', .65),
  screenGold: luminous('#ecbc81', .53),
  paper: standard('#f9f4e8'),
  black: standard('#263441'),
  rubber: standard('#363a40', .85),
  steel: standard('#7b8b94', .48, .25),
  blue: standard('#465f80', .43),
  red: standard('#c44834', .49),
  coral: standard('#d76b59', .55),
  teal: standard('#537a79'),
  rose: standard('#e8aaa4'),
  moss: standard('#426d52'),
  mint: standard('#9aba93'),
  cream: standard('#e5d5ae'),
  carton: timber('#c49975'),
  tape: standard('#e9cc99'),
}

export type MaterialName = keyof typeof materials

interface SolidProps {
  at?: Position
  size: Position
  material: MaterialName
  cast?: boolean
  receive?: boolean
  rotation?: Position
}

export function Block({ at = [0, 0, 0], size, material, cast = true, receive, rotation }: SolidProps) {
  return <mesh position={at} scale={size} rotation={rotation} geometry={box} material={materials[material]} castShadow={cast} receiveShadow={receive} />
}

export function Round({ at = [0, 0, 0], size, material, cast = true, receive, rotation }: SolidProps) {
  return <mesh position={at} scale={size} rotation={rotation} geometry={cylinder} material={materials[material]} castShadow={cast} receiveShadow={receive} />
}

export function Orb({ at = [0, 0, 0], size, material, cast = true, rotation }: SolidProps) {
  return <mesh position={at} scale={size} rotation={rotation} geometry={sphere} material={materials[material]} castShadow={cast} />
}

export function Ring({ at = [0, 0, 0], size, material, rotation }: SolidProps) {
  return <mesh position={at} scale={size} rotation={rotation} geometry={ring} material={materials[material]} />
}

export function Parcel({ at, size = [.45, .34, .39] }: { at: Position; size?: Position }) {
  const [width, height, depth] = size
  return (
    <group position={at}>
      <Block at={[0, height / 2, 0]} size={size} material="carton" />
      <Block at={[0, height + .004, 0]} size={[width * .20, .012, depth + .008]} material="tape" cast={false} />
      <Block at={[0, height * .80, depth / 2 + .006]} size={[width * .20, height * .41, .013]} material="tape" cast={false} />
      <Block at={[width * .26, height * .55, depth / 2 + .009]} size={[width * .33, height * .21, .018]} material="paper" cast={false} />
    </group>
  )
}

// Shared clipped-corner armour shells; the bevel catches the key light at phone scale.
const shoulderProfile = new Shape()
shoulderProfile.moveTo(-.51, -.30)
shoulderProfile.lineTo(-.40, .26)
shoulderProfile.lineTo(-.18, .49)
shoulderProfile.lineTo(.36, .44)
shoulderProfile.lineTo(.51, .21)
shoulderProfile.lineTo(.45, -.39)
shoulderProfile.lineTo(-.21, -.48)
shoulderProfile.closePath()
const shell = new ExtrudeGeometry(shoulderProfile, { depth: .84, bevelEnabled: true, bevelThickness: .06, bevelSize: .04, bevelSegments: 1 })
shell.translate(0, 0, -.42)

function Armor({ at, size, material, rotation }: SolidProps) {
  return <mesh position={at} rotation={rotation} scale={size} geometry={shell} material={materials[material]} castShadow receiveShadow />
}

function Robot() {
  return <group rotation={[0, -.06, .027]}>
    <Block at={[0, .57, -.025]} size={[.34, .30, .225]} material="graphite"/>
    <Armor at={[0, .636, .05]} size={[.405, .218, .245]} material="blue" rotation={[.064, 0, 0]}/>
    <Armor at={[.09, .677, .167]} size={[.154, .076, .049]} material="paper" rotation={[0, 0, -.12]}/>
    <Armor at={[-.09, .677, .167]} size={[.154, .076, .049]} material="paper" rotation={[0, 0, .12]}/>
    <Block at={[0, .609, .176]} size={[.096, .048, .036]} material="red"/>
    <Armor at={[0, .439, .010]} size={[.27, .114, .226]} material="enamel"/>
    <Block at={[0, .422, .136]} size={[.090, .073, .031]} material="red"/>
    <Round at={[0, .762, .011]} size={[.071, .076, .071]} material="graphite"/>
    <Armor at={[0, .869, .024]} size={[.233, .207, .222]} material="paper" rotation={[.12, 0, -.06]}/>
    <Block at={[0, .861, .150]} size={[.19, .068, .022]} material="graphite" rotation={[0, 0, -.045]}/>
    <Block at={[.013, .866, .165]} size={[.138, .022, .014]} material="screenMint" rotation={[0, 0, -.045]}/>
    <Armor at={[0, .820, .149]} size={[.067, .059, .042]} material="red"/>
    <Block at={[-.106, .964, .026]} size={[.030, .175, .043]} material="blue" rotation={[0, 0, .22]}/>
    <Block at={[-.126, 1.045, .026]} size={[.032, .042, .045]} material="red" rotation={[0, 0, .22]}/>
    <Armor at={[0, .658, -.199]} size={[.264, .315, .18]} material="blue"/>
    {[-1, 1].map(side => <group key={side}>
      <Round at={[side * .159, .624, -.187]} size={[.061, .274, .069]} material="steel"/>
      <Round at={[side * .159, .490, -.187]} size={[.070, .045, .076]} material="graphite"/>
      <group position={[side * .248, .669, .00]} rotation={[side < 0 ? -.24 : -.03, 0, side * .15]}>
        <Round size={[.078, .11, .075]} material="graphite" rotation={[0, 0, Math.PI/2]}/>
        <Armor at={[side * .025, .022, .008]} size={[.230, .158, .235]} material={side < 0 ? 'red' : 'paper'}/>
        <Block at={[side * .049, -.014, .121]} size={[.143, .029, .017]} material={side < 0 ? 'paper' : 'red'}/>
        <Armor at={[0, -.114, .001]} size={[.111, .143, .139]} material="slate"/>
        <Round at={[0, -.191, .023]} size={[.073, .132, .073]} material="graphite" rotation={[0,0,Math.PI/2]}/>
        <group position={[0,-.206,.031]} rotation={[side < 0 ? -.48 : -.12, 0, 0]}>
          <Armor at={[side * .012, -.073, .010]} size={[.146, .185, .176]} material="paper"/>
          <Block at={[side * .015, -.045, .104]} size={[.080, .044, .017]} material="blue"/>
          <Armor at={[0, -.193, .024]} size={[.104, .090, .144]} material="graphite"/>
        </group>
      </group>
      <group position={[side * .094, .406, side < 0 ? -.025 : .041]} rotation={[side < 0 ? .05 : -.10, 0, side * .092]}>
        <Armor at={[0, -.108, 0]} size={[.128, .188, .157]} material="paper"/>
        <Round at={[0, -.204, .006]} size={[.071, .139, .071]} material="graphite" rotation={[0,0,Math.PI/2]}/>
        <Armor at={[0, -.201, .081]} size={[.141, .091, .057]} material="blue" rotation={[-.21,0,0]}/>
        <Armor at={[0, -.286, .001]} size={[.145, .188, .163]} material="enamel" rotation={[-.04,0,0]}/>
        <Block at={[0, -.278, .084]} size={[.071, .090, .023]} material="paper"/>
        <Armor at={[0, -.252, -.101]} size={[.123,.159,.097]} material="blue" rotation={[-.18,0,0]}/>
        <Armor at={[0, -.355, .0565]} size={[.153, .080, .258]} material="red"/>
        <Block at={[0, -.395, .047]} size={[.158, .030, .265]} material="graphite"/>
      </group>
    </group>)}
  </group>
}

function ForestFigure({ blue = false }: { blue?: boolean }) {
  const color = blue ? 'blue' : 'moss'
  return (
    <>
      <Orb at={[0, .27, 0]} size={[.23, .255, .18]} material={color} />
      <Orb at={[0, .55, .03]} size={[.30, .27, .23]} material={blue ? 'blue' : 'mint'} />
      <Orb at={[0, .49, .196]} size={[.202, .179, .105]} material="cream" />
      {blue && <>
        <Ring at={[0, .928, -.001]} size={[.103, .116, .66]} material="brass" />
        <Orb at={[0, .770, -.119]} size={[.104, .265, .112]} rotation={[-.68, 0, -.14]} material="blue" />
        <Orb at={[-.119, .655, -.147]} size={[.101, .21, .108]} rotation={[-.88, 0, .49]} material="blue" />
      </>}
      <Orb at={[0, .465, .267]} size={[.042, .031, .033]} material="ebony" />
      {[1, -1].map(side => (
        <group key={side}>
          <Orb at={[side * .215, .755, .02]} size={[.116, .127, .097]} material={color} />
          <Orb at={[side * .216, .757, .092]} size={[.066, .078, .037]} material="rose" />
          <Orb at={[side * .103, .549, .275]} size={[.032, .039, .026]} material="black" />
          <Orb at={[side * .10, .048, .062]} size={[.090, .062, .126]} material={color} />
        </group>
      ))}
    </>
  )
}

function Book({ color, thick = false }: { color: MaterialName; thick?: boolean }) {
  const depth = thick ? .18 : .085
  return (
    <group rotation={[0, -.15, -.12]}>
      <Block at={[0, .39, 0]} size={[.50, .74, depth]} material={color} />
      <Block at={[.011, .39, -.015]} size={[.45, .682, depth + .015]} material="paper" />
      <Block at={[0, .39, depth / 2 + .004]} size={[.51, .74, .023]} material={color} />
      <Block at={[0, .49, depth / 2 + .021]} size={[.346, .192, .016]} material="brass" />
      <Block at={[0, .30, depth / 2 + .024]} size={[.298, .027, .016]} material="paper" />
      <Block at={[-.045, .247, depth / 2 + .024]} size={[.200, .020, .016]} material="paper" />
    </group>
  )
}

function Album({ sku }: { sku: string }) {
  const cover = sku.startsWith('KIBOU') ? 'teal' : sku.startsWith('KISS-B') ? 'coral' : 'blue'
  return (
    <group rotation={[-.08, -.15, -.06]}>
      <Block at={[-.043, .32, 0]} size={[.58, .59, .085]} material={cover} />
      <Round at={[.135, .38, -.08]} size={[.282, .026, .282]} rotation={[Math.PI / 2, 0, 0]} material="steel" />
      <Round at={[.135, .38, -.061]} size={[.089, .012, .089]} rotation={[Math.PI / 2, 0, 0]} material="paper" />
      <Ring at={[-.041, .34, .054]} size={[.177, .177, .22]} material="cream" />
      <Block at={[-.041, .148, .055]} size={[.259, .022, .015]} material="paper" />
    </group>
  )
}

function SignatureCard() {
  return (
    <group rotation={[-.11, -.18, 0]}>
      <Block at={[0, .34, 0]} size={[.68, .54, .055]} material="brass" />
      <Block at={[0, .34, .033]} size={[.63, .49, .012]} material="paper" />
      <Block at={[-.17, .37, .042]} size={[.16, .18, .012]} material="coral" />
      <Ring at={[.024, .292, .047]} size={[.051, .103, .145]} rotation={[0, 0, -.46]} material="black" />
      <Block at={[.113, .283, .047]} size={[.19, .013, .012]} rotation={[0, 0, .23]} material="black" />
      <Block at={[.085, .444, .047]} size={[.183, .028, .012]} material="teal" />
    </group>
  )
}

function Cat({ alternate }: { alternate: boolean }) {
  return (
    <>
      <Orb at={[0, .17, -.015]} size={[.197, .175, .137]} material={alternate ? 'teal' : 'coral'} />
      <Orb at={[0, .42, .022]} size={[.27, .193, .168]} material="paper" />
      <Orb at={[0, .405, .182]} size={[.035, .022, .018]} material="brass" />
      <Orb at={[.172, .51, .14]} size={[.104, .047, .052]} rotation={[0, 0, .43]} material={alternate ? 'blue' : 'red'} />
      {[1, -1].map(side => (
        <group key={side}>
          <Orb at={[side * .114, .44, .163]} size={[.027, .031, .018]} material="black" />
          <Orb at={[side * .159, .555, -.006]} size={[.096, .135, .075]} material="paper" rotation={[0, 0, side * .39]} />
        </group>
      ))}
    </>
  )
}

function Car() {
  return (
    <group rotation={[0, -.30, 0]}>
      <Block at={[0, .177, 0]} size={[.89, .193, .42]} material="blue" />
      <Block at={[-.076, .33, 0]} size={[.417, .138, .35]} material="blue" />
      <Block at={[-.033, .312, .179]} size={[.294, .103, .022]} material="black" />
      <Block at={[.431, .159, 0]} size={[.062, .098, .37]} material="brass" />
      <Block at={[.238, .282, 0]} size={[.276, .021, .071]} material="paper" />
      {[-.29, .29].map(x => [-.196, .196].map(z => (
        <Round key={`${x}:${z}`} at={[x, .110, z]} size={[.104, .062, .104]} material="rubber" rotation={[Math.PI / 2, 0, 0]} />
      )))}
    </group>
  )
}

export function Collectible({ sku, scale = 1 }: { sku: string; scale?: number }) {
  let model: ReactNode
  if (sku === 'ROBOT') model = <Robot />
  else if (sku === 'RARE-CAR') model = <Car />
  else if (sku === 'SONIC' || sku === 'FOREST') model = <ForestFigure blue={sku === 'SONIC'} />
  else if (sku.startsWith('KITTY')) model = <Cat alternate={sku.endsWith('-B')} />
  else if (sku.endsWith('-CD')) model = <Album sku={sku} />
  else if (sku.startsWith('KIBOU')) model = <Book color="teal" thick />
  else if (sku === 'FORTUNE') model = <SignatureCard />
  else model = <Book color={sku.endsWith('-PH') ? 'rose' : 'coral'} />
  return <group scale={scale}>{model}</group>
}
