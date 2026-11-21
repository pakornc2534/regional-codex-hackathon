import { ArchiveRestore, Boxes, ChartNoAxesCombined, ClipboardList, Monitor, PackageOpen, PackageCheck, Truck, Wallet } from 'lucide-react'
import { stations, workspaceNames } from '../workspaces'
import { describeTarget, type SceneLabels, type SceneTarget, type SceneVariant, type SceneZone } from './scene-model'

const rails = {
  left: ['product', 'computer', 'cashier', 'returns'],
  right: ['insights', 'picking', 'packing', 'staging', 'carrier'],
} as const

const icons = {
  product: Boxes, computer: Monitor, cashier: Wallet, returns: ArchiveRestore, insights: ChartNoAxesCombined,
  picking: ClipboardList, packing: PackageOpen, staging: PackageCheck, carrier: Truck,
}

export function SceneCallouts({ selected, labels, active, shown, hovered, onHover, onOpen }: {
  selected?: SceneVariant
  labels?: SceneLabels
  active: boolean
  shown: boolean
  hovered: SceneZone | null
  onHover: (zone: SceneZone | null) => void
  onOpen: (target: SceneTarget) => void
}) {
  return <div className="diorama-callouts" hidden={!shown}>
    <svg className="diorama-leaders" aria-hidden="true" focusable="false">
      {Object.values(rails).flat().filter(zone => zone !== 'product' || selected).map(zone => <g key={zone} data-zone={zone} data-active={hovered === zone}>
        <polyline />
        <circle r="3.2" />
      </g>)}
    </svg>
    {(['left', 'right'] as const).map(side => <div key={side} className="diorama-rail" data-side={side}>
      {rails[side].map(zone => {
        const target: SceneTarget | undefined = zone === 'product'
          ? selected && { zone, variant: selected }
          : { zone }
        if (!target) return null
        const { name, page } = stations[zone]
        const title = workspaceNames[page]
        const Icon = icons[zone]
        return <button key={zone} type="button" className="diorama-callout" data-zone={zone} data-active={hovered === zone}
          disabled={!active} aria-label={title + ' · ' + name} title={describeTarget(target, labels).detail}
          onFocus={() => onHover(zone)} onBlur={() => onHover(null)}
          onMouseEnter={() => onHover(zone)} onMouseLeave={() => onHover(null)}
          onClick={() => onOpen(target)}>
          <Icon size={16} aria-hidden="true" />
          <span><strong>{title}</strong><small>{name}</small></span>
        </button>
      })}
    </div>)}
  </div>
}
