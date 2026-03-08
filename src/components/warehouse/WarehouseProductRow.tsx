import React from 'react';
import { useNavigate } from 'react-router-dom';
import { History, QrCode, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Product } from '../../types/warehouse';
import { getProductEffectivePrice } from '../../utils/warehousePricing';

export interface WarehouseProductRowProps {
  product: Product;
  onContextMenu: (e: React.MouseEvent, product: Product) => void;
  onProductClick: (product: Product) => void;
  onViewHistory: (product: Product) => void;
  onViewQRCode: (product: Product) => void;
  style?: React.CSSProperties;
}

function formatDisplayPrice(product: Product): string {
  const price = product.displayPrice ?? getProductEffectivePrice(product);
  return price ? `${Math.floor(price).toLocaleString()} ₸` : '—';
}

export const WarehouseProductRow: React.FC<WarehouseProductRowProps> = ({
  product,
  onContextMenu,
  onProductClick,
  onViewHistory,
  onViewQRCode,
  style
}) => {
  const navigate = useNavigate();

  const handleClick = () => onProductClick(product);
  const handleContextMenu = (e: React.MouseEvent) => onContextMenu(e, product);

  return (
    <div
      style={style}
      className="group bg-white hover:bg-gray-50 border rounded-md cursor-pointer transition-colors mx-0.5 mb-0.5"
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      {/* Мобильная версия — больше воздуха для читаемости */}
      <div className="sm:hidden px-2 py-1.5">
        <div className="flex items-center justify-between gap-1">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm text-gray-900 truncate">{product.name}</span>
              {product.quantity <= (product.minQuantity || 5) && (
                <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-500" />
              )}
            </div>
            <div className="flex items-center gap-2 mt-0">
              <span className="text-xs text-gray-500">{product.category || '—'}</span>
              <span className="text-xs font-medium text-emerald-600">
                {product.quantity} {product.unit}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate('/warehouse/income/new', { state: { addedProduct: { product, quantity: 1 } } });
              }}
              className="p-1.5 text-emerald-600"
            >
              <ArrowUpRight className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                navigate('/warehouse/expense/new', { state: { addedProduct: { product, quantity: 1 } } });
              }}
              className="p-1.5 text-red-600"
            >
              <ArrowDownRight className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewHistory(product);
              }}
              className="p-1.5 text-blue-600"
            >
              <History className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewQRCode(product);
              }}
              className="p-1.5 text-purple-600"
            >
              <QrCode className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Десктопная версия — компактно (py-1) */}
      <div className="hidden sm:flex items-center px-4 py-1">
        <div className="flex-1 grid grid-cols-[1fr,120px,100px] gap-4 items-center min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium text-sm text-gray-900 truncate">{product.name}</span>
            {product.quantity <= (product.minQuantity || 5) && (
              <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-red-500" />
            )}
            <span className="text-sm text-gray-500">{product.category || '—'}</span>
          </div>
          <div className="text-sm text-gray-900">
            {product.quantity} {product.unit}
          </div>
          <div className="text-sm text-gray-500">{formatDisplayPrice(product)}</div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate('/warehouse/income/new', { state: { addedProduct: { product, quantity: 1 } } });
            }}
            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
            title="Добавить в приход"
          >
            <ArrowUpRight className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate('/warehouse/expense/new', { state: { addedProduct: { product, quantity: 1 } } });
            }}
            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
            title="Добавить в расход"
          >
            <ArrowDownRight className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewHistory(product);
            }}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
            title="История транзакций"
          >
            <History className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewQRCode(product);
            }}
            className="p-1.5 text-purple-600 hover:bg-purple-50 rounded"
            title="QR-код"
          >
            <QrCode className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
