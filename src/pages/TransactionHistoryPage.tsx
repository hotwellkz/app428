import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ArrowLeft } from 'lucide-react';
import { TransactionHistory } from '../components/warehouse/TransactionHistory';
import { Product } from '../types/warehouse';

/**
 * Страница истории движений товара склада.
 * Маршрут: /warehouse/transactions/:productId
 */
const TransactionHistoryPage: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!productId) return;
    getDoc(doc(db, 'products', productId))
      .then((snap) => {
        if (snap.exists()) {
          setProduct({ id: snap.id, ...snap.data() } as Product);
        } else {
          setProduct(null);
        }
      })
      .catch(() => setProduct(null))
      .finally(() => setLoading(false));
  }, [productId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-sm text-gray-500">Загрузка...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col items-center gap-4">
          <p className="text-sm text-gray-500">Товар не найден.</p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-blue-600 hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Назад
          </button>
        </div>
      </div>
    );
  }

  return (
    <TransactionHistory
      product={product as Product & { warehouse?: string }}
      isOpen
      onClose={() => navigate(-1)}
    />
  );
};

export default TransactionHistoryPage;
