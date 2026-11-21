import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CanvasTexture, Object3D, SRGBColorSpace, type Group, type Mesh, type MeshBasicMaterial, type SpotLight, type Vector3 } from 'three'

interface HighlightPart {
  pivot: Group
  size: Vector3
}

function glowTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const glow = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
  glow.addColorStop(0, '#fff2bb')
  glow.addColorStop(.48, '#ffdc83f0')
  glow.addColorStop(.62, '#ffd478c8')
  glow.addColorStop(.70, '#ffbb534d')
  glow.addColorStop(1, '#ffaf4100')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, 128, 128)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

export const hoverScale = 1.18

export function HoverHighlight({ parts, focused }: { parts: HighlightPart[]; focused?: HighlightPart }) {
  const light = useRef<SpotLight>(null!)
  const aim = useMemo(() => new Object3D(), [])
  const pool = useRef<Mesh>(null!)
  const material = useRef<MeshBasicMaterial>(null!)
  const lastLit = useRef<HighlightPart | undefined>(undefined)
  const texture = useMemo(glowTexture, [])
  const motion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)'), [])
  const invalidate = useThree(state => state.invalidate)
  useEffect(() => () => texture.dispose(), [texture])
  useEffect(() => {
    const refresh = () => invalidate()
    motion.addEventListener('change', refresh)
    return () => motion.removeEventListener('change', refresh)
  }, [motion, invalidate])
  useLayoutEffect(() => { invalidate() }, [focused, parts, invalidate])

  useFrame((state, delta) => {
    // An idle demand-rendered canvas can report a long delta on its first frame.
    const step = motion.matches ? 1 : 1 - Math.exp(-18 * Math.min(delta, 1 / 30))
    for (const part of parts) {
      const target = part === focused ? hoverScale : 1
      const scale = part.pivot.scale.x
      if (scale === target) continue
      const next = scale + (target - scale) * step
      part.pivot.scale.setScalar(Math.abs(target - next) < .001 ? target : next)
      if (part.pivot.scale.x !== target) state.invalidate()
    }

    // Reuse one light and one feathered pool while moving between objects.
    const lit = focused ?? lastLit.current
    if (lit && parts.includes(lit) && lit.pivot.scale.x > 1) {
      lastLit.current = lit
      const { position, scale } = lit.pivot
      const { x: width, y: height, z: depth } = lit.size
      const strength = (scale.x - 1) / (hoverScale - 1)
      pool.current.visible = true
      pool.current.position.copy(position)
      pool.current.position.y += .012
      pool.current.scale.set(width * 1.85, Math.max(depth * 1.85, width * .8), 1)
      material.current.opacity = .92 * strength
      aim.position.set(position.x, position.y + height * .65, position.z)
      light.current.position.set(position.x, position.y + .018, position.z + depth * .7)
      light.current.distance = Math.max(height, width, depth) * 1.7
      light.current.intensity = strength * light.current.distance ** 2 * .95
    } else {
      lastLit.current = undefined
      pool.current.visible = false
      light.current.intensity = 0
    }
  }, -0.5)

  return <>
    <primitive object={aim} />
    <spotLight ref={light} target={aim} color="#ffce80" intensity={0} angle={1.1} penumbra={.8} />
    <mesh ref={pool} visible={false} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial ref={material} map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  </>
}
