import type { ReactNode } from 'react'
import { BoxGeometry, CylinderGeometry, MeshStandardMaterial, SphereGeometry, TorusGeometry } from 'three'
import type { Position } from './scene-model'

const box = new BoxGeometry(1, 1, 1)
const cylinder = new CylinderGeometry(1, 1, 1, 32)
const sphere = new SphereGeometry(1, 16, 12)
const ring = new TorusGeometry(1, 0.045, 8, 48)

const standard = (color: string, roughness = .72, metalness = 0) =>
  new MeshStandardMaterial({ color, roughness, metalness })

const luminous = (color: string, intensity: number) =>
  new MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: .45 })

export const materials = {
  foundation: standard('#333b39'),
  edge: standard('#a88d70'),
  stone: standard('#eee6d5'),
  paleStone: standard('#f8edd9'),
  seam: standard('#d3c0a4'),
  clay: standard('#b97455'),
  shadeClay: standard('#91563e'),
  plaster: standard('#bd9677'),
  ivory: standard('#f0dabb'),
  archPanel: standard('#463b32'),
  wood: standard('#805739'),
  paleWood: standard('#b88a59'),
  ebony: standard('#483629'),
  brass: standard('#c5a46d', .3, .65),
  gold: luminous('#ffca76', 1.9),
  warmWhite: luminous('#fff0be', 1.4),
  warmGlass: luminous('#5b4125', .16),
  darkGreen: standard('#263f3c', .5),
  teal: standard('#3c7669'),
  screen: luminous('#24443f', .9),
  screenMint: luminous('#97d0b4', .8),
  screenGold: luminous('#dba464', .65),
  paper: standard('#faf1de'),
  black: standard('#253237'),
  rubber: standard('#24292a', .88),
  steel: standard('#77868a', .31, .35),
  blue: standard('#42749d', .42),
  red: standard('#a64a32', .41),
  coral: standard('#c36f5e', .6),
  rose: standard('#e6b2a3'),
  moss: standard('#647a47'),
  mint: standard('#93ac83'),
  cream: standard('#e9dbb9'),
  carton: standard('#b98555'),
  tape: standard('#eacba5'),
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
      <Block at={[0, .85, .007]} size={[.26, .215, .21]} material="paper" />
      <Block at={[0, .838, .119]} size={[.205, .071, .035]} material="black" />
      <Block at={[-.056, .84, .14]} size={[.052, .029, .013]} material="screenMint" />
      <Block at={[.056, .84, .14]} size={[.052, .029, .013]} material="screenMint" />
      <Block at={[0, .97, .051]} size={[.057, .052, .076]} material="red" />
      <Block at={[0, 1.033, .027]} size={[.255, .031, .036]} rotation={[0, 0, .19]} material="brass" />
      {[1, -1].map(side => (
        <group key={side}>
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
  else if (sku.startsWith('KIBOU')) model = <Book color={sku.endsWith('-CD') ? 'teal' : 'wood'} thick />
  else if (sku === 'FORTUNE') model = <Book color="ebony" />
  else model = <Book color={sku.endsWith('-PH') ? 'rose' : 'coral'} />
  return <group scale={scale}>{model}</group>
}
