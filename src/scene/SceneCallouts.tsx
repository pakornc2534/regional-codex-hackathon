import { useId } from 'react'
import { ArchiveRestore, Boxes, ChartNoAxesCombined, ClipboardList, MapPin, Monitor, PackageOpen, PackageCheck, Truck, Wallet } from 'lucide-react'
import { stations, workspaceNames } from '../workspaces'
import { describeTarget, type SceneLabels, type SceneTarget, type SceneVariant, type SceneZone } from './scene-model'

const rails = {
  left: ['product', 'computer', 'cashier', 'returns'],
  right: ['insights', 'picking', 'packing', 'staging', 'carrier'],
} as const

const icons = {
  product: Boxes, computer: Monitor, cashier: Wallet, insights: ChartNoAxesCombined,
  picking: ClipboardList, packing: PackageOpen, staging: PackageCheck, carrier: Truck, returns: ArchiveRestore,
}

export function SceneCallouts({ selected, labels, active, shown, focused, onToggle, onHover, onOpen }: {
  selected?: SceneVariant
  labels?: SceneLabels
  active: boolean
  shown: boolean
  focused?: SceneTarget
  onToggle: () => void
  onHover: (zone: SceneZone | null) => void
  onOpen: (target: SceneTarget) => void
}) {
  const menuId = useId()
  const info = focused && describeTarget(focused, labels)
  const lines: string[] = shown ? Object.values(rails).flat().filter(zone => zone !== 'product' || selected) : []
  if (focused) lines.push('focus')

  return <section className="diorama-callouts" aria-label="จุดในร้าน">
    <svg className="diorama-leaders" aria-hidden="true" focusable="false">
      {lines.map(id => <g key={id} data-line={id} data-active={id === focused?.zone || id === 'focus'}>
        <polyline /><circle r="2" />
      </g>)}
    </svg>
    <div className="diorama-focus-lane">
      {info && <div className="diorama-focus"><strong>{info.title}</strong><span>{info.detail}</span></div>}
    </div>
    <button type="button" className="diorama-pins" disabled={!active} onClick={onToggle}
      aria-expanded={shown} aria-controls={menuId}><MapPin size={14} aria-hidden="true" />{shown ? 'ซ่อนป้าย' : 'แสดงป้าย'}</button>
    <div id={menuId} className="diorama-locations" hidden={!shown}>
      {(['left', 'right'] as const).map(side => <div className={'diorama-rail diorama-rail--' + side} key={side}>
        {rails[side].map(zone => {
          const target: SceneTarget | undefined = zone === 'product' ? selected && { zone, variant: selected } : { zone }
          if (!target) return null
          const { name, page } = stations[zone]
          const StationIcon = icons[zone]
          return <button key={zone} type="button" className="diorama-callout" data-zone={zone} data-active={focused?.zone === zone}
            disabled={!active} aria-label={workspaceNames[page] + ' · ' + name} aria-description={describeTarget(target, labels).detail}
            onFocus={() => onHover(zone)} onBlur={() => onHover(null)}
            onMouseEnter={() => onHover(zone)} onMouseLeave={() => onHover(null)}
            onClick={() => onOpen(target)}>
            <StationIcon size={16} strokeWidth={1.65} aria-hidden="true" />
            <span>{name}</span>
          </button>
        })}
      </div>)}
    </div>
  </section>
}
