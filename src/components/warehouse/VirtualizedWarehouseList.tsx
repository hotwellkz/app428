import React, { useRef, useState, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Product } from '../../types/warehouse';
import { WarehouseProductRow } from './WarehouseProductRow';

const ROW_HEIGHT_MOBILE = 48;
const ROW_HEIGHT_DESKTOP = 32;
const MOBILE_BREAKPOINT = 768;
const OVERSCAN = 5;

function getRowHeight(): number {
  if (typeof window === 'undefined') return ROW_HEIGHT_DESKTOP;
  return window.innerWidth < MOBILE_BREAKPOINT ? ROW_HEIGHT_MOBILE : ROW_HEIGHT_DESKTOP;
}

export interface VirtualizedWarehouseListProps {
  products: Product[];
  height: number;
  width?: string | number;
  onContextMenu: (e: React.MouseEvent, product: Product) => void;
  onProductClick: (product: Product) => void;
  onViewHistory: (product: Product) => void;
  onViewQRCode: (product: Product) => void;
}

export const VirtualizedWarehouseList: React.FC<VirtualizedWarehouseListProps> = ({
  products,
  height,
  width = '100%',
  onContextMenu,
  onProductClick,
  onViewHistory,
  onViewQRCode
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const [rowHeight, setRowHeight] = useState(getRowHeight);

  useEffect(() => {
    const onResize = () => setRowHeight(getRowHeight());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const virtualizer = useVirtualizer({
    count: products.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: OVERSCAN
  });

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      style={{
        height,
        width,
        overflow: 'auto'
      }}
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: '100%',
          position: 'relative'
        }}
      >
        {virtualItems.map((virtualRow) => {
          const product = products[virtualRow.index];
          if (!product) return null;
          return (
            <div
              key={product.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`
              }}
            >
              <WarehouseProductRow
                product={product}
                onContextMenu={onContextMenu}
                onProductClick={onProductClick}
                onViewHistory={onViewHistory}
                onViewQRCode={onViewQRCode}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
