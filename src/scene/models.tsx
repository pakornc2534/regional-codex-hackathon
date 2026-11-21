import type { ReactNode } from 'react'
import { BoxGeometry, CylinderGeometry, DataTexture, LinearFilter, MeshStandardMaterial, RepeatWrapping, SphereGeometry, TorusGeometry } from 'three'
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

export const materials = {
  foundation: standard('#0e2729', .62),
  edge: standard('#b6945f', .38, .32),
  stone: mineral('#eee6ce'),
  paleStone: mineral('#fff2d7'),
  seam: standard('#b5ab94'),
  clay: mineral('#c77e61'),
  shadeClay: standard('#975942'),
  plaster: standard('#114b4a'),
  ivory: mineral('#edd9ae'),
  archPanel: standard('#144440'),
  wood: timber('#594134'),
  paleWood: timber('#b38852'),
  ebony: standard('#302d29'),
  brass: standard('#bc9860', .37, .43),
  gold: luminous('#ffca69', .76),
  warmWhite: luminous('#ffe2a2', 1.12),
  warmGlass: standard('#32665a', .42),
  darkGreen: standard('#0d3533', .46),
  teal: standard('#277566'),
  screen: luminous('#153d3e', .55),
  screenMint: luminous('#8dd4a3', .65),
  screenGold: luminous('#dba464', .65),
  paper: standard('#fff9e5'),
  black: standard('#172a32'),
  rubber: standard('#21252c', .88),
  steel: standard('#72878a', .36, .29),
  blue: standard('#315b9b', .38),
  red: standard('#b74236', .46),
  coral: standard('#d96556', .56),
  rose: standard('#f0b1a5'),
  moss: standard('#366d42'),
  mint: standard('#96bf90'),
  cream: standard('#f5deaa'),
  carton: timber('#c59063'),
  tape: standard('#e7c994'),
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

function Robot() {
  return (
    <>
      <Block at={[0, .61, 0]} size={[.39, .25, .23]} material="paper" />
      <Block at={[0, .59, .128]} size={[.33, .125, .034]} material="blue" />
      <Block at={[0, .602, .154]} size={[.115, .072, .025]} material="gold" />
      <Block at={[0, .422, .02]} size={[.295, .111, .22]} material="black" />
      <Block at={[0, .395, .12]} size={[.23, .065, .048]} material="cream" />
      <Block at={[0, .74, -.13]} size={[.295, .29, .16]} material="blue" />
      <Block at={[0, .85, .007]} size={[.26, .215, .21]} material="paper" />
      <Block at={[0, .838, .119]} size={[.205, .071, .035]} material="black" />
      <Block at={[-.056, .84, .14]} size={[.052, .029, .013]} material="screenMint" />
      <Block at={[.056, .84, .14]} size={[.052, .029, .013]} material="screenMint" />
      <Block at={[0, .97, .051]} size={[.057, .052, .076]} material="red" />
      <Block at={[0, 1.033, .027]} size={[.255, .031, .036]} rotation={[0, 0, .19]} material="brass" />
      {[1, -1].map(side => (
        <group key={side}>
          <Block at={[side * .122, .993, .078]} size={[.025, .20, .037]} rotation={[0, 0, -side * .71]} material="warmWhite" />
          <Block at={[side * .164, .64, -.162]} size={[.10, .33, .087]} rotation={[-.26, 0, -side * .38]} material="blue" />
          <Block at={[side * .286, .665, -.007]} size={[.20, .086, .25]} rotation={[0, 0, -side * .12]} material="blue" />
          <Block at={[side * .327, .37, .033]} size={[.119, .127, .147]} material="paper" />
          <Block at={[side * .337, .278, .051]} size={[.087, .073, .10]} material="black" />
          <Block at={[side * .26, .638, -.01]} size={[.151, .17, .24]} rotation={[0, 0, side * .16]} material="paper" />
          <Block at={[side * .30, .456, .004]} size={[.095, .244, .125]} rotation={[0, 0, side * .14]} material="steel" />
          <Block at={[side * .32, .541, .078]} size={[.084, .105, .03]} material="red" />
          <Block at={[side * .113, .283, 0]} size={[.142, .327, .153]} rotation={[0, 0, side * .11]} material="paper" />
          <Block at={[side * .137, .282, .078]} size={[.122, .076, .033]} material="steel" />
          <Block at={[side * .159, .088, .04]} size={[.186, .105, .27]} material="red" />
          <Block at={[side * .159, .031, .048]} size={[.192, .041, .28]} material="black" />
        </group>
      ))}
    </>
  )
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
