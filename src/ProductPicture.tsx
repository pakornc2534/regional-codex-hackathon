import type { Variant } from './model';
import { ShopIcon } from './ShopIcon';
import './product-picture.css';

const catalogArt = {
  ROBOT: 'model-kit',
  FOREST: 'forest',
  'KISS-B-CD': 'disc',
  'KISS-S-CD': 'disc',
  'KIBOU-CD': 'disc',
  'KISS-B-PH': 'photobook',
  'KISS-S-PH': 'photobook',
  'KIBOU-PH': 'photobook',
  'KITTY-A': 'cat',
  'KITTY-B': 'cat',
  SONIC: 'keychain',
  'RARE-CAR': 'model-car',
};

function hasArt(sku: string): sku is keyof typeof catalogArt {
  return Object.hasOwn(catalogArt, sku);
}

function imageUrl(file: string) {
  return new URL(`./art/${file}.webp`, import.meta.url).href;
}

type ProductPictureProps = {
  variant: Pick<Variant, 'sellerSku'>;
  featured?: boolean;
};

export function ProductPicture({ variant, featured = false }: ProductPictureProps) {
  const sku = variant.sellerSku;
  const className = featured ? 'product-picture picture-featured' : 'product-picture';
  if (!hasArt(sku)) {
    return <span className={className + ' picture-symbol'} aria-hidden="true">
      <ShopIcon name={sku === 'FORTUNE' ? 'signed' : 'stock'}/>
    </span>;
  }
  const art = catalogArt[sku];
  if (featured && art === 'model-kit') {
    return <img className={className + ' picture-robot'} alt="" width="960" height="640"
      src={imageUrl('model-kit-480')}
      srcSet={imageUrl('model-kit-480') + ' 480w, ' + imageUrl('model-kit-960') + ' 960w'}
      sizes="(max-width: 620px) 94vw, (max-width: 949px) 60vw, 420px" decoding="async"/>;
  }
  const side = featured ? 448 : 112;
  return <img className={className} alt="" width={side} height={side}
    src={imageUrl(featured ? art : art + '-thumb')} loading={featured ? 'eager' : 'lazy'} decoding="async"/>;
}
