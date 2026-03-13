import React, { useMemo, useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useCompanyId } from '../contexts/CompanyContext';
import { usePipelines, usePipelineStages, useDeals } from '../hooks/useDeals';
import type { Deal, DealsPipelineStage } from '../types/deals';
import { createDeal, moveDealToStage } from '../lib/firebase/deals';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Plus, Settings2, MessageCircle, X } from 'lucide-react';

export const DealsPage: React.FC = () => {
  const companyId = useCompanyId();
  const [searchParams, setSearchParams] = useSearchParams();
  const dealIdFromUrl = searchParams.get('deal');
  const [detailDeal, setDetailDeal] = useState<Deal | null>(null);
  const { pipelines, loading: loadingPipelines, error: pipelinesError } = usePipelines(companyId);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);

  const effectivePipelineId =
    selectedPipelineId ?? (pipelines.length > 0 ? pipelines[0].id : null);

  const { stages, loading: loadingStages } = usePipelineStages(companyId, effectivePipelineId);
  const { deals, loading: loadingDeals } = useDeals(companyId, effectivePipelineId);

  const [creating, setCreating] = useState(false);

  const groupedDeals = useMemo(() => {
    const byStage: Record<string, Deal[]> = {};
    for (const stage of stages) {
      byStage[stage.id] = [];
    }
    for (const deal of deals) {
      if (!byStage[deal.stageId]) byStage[deal.stageId] = [];
      byStage[deal.stageId].push(deal);
    }
    Object.values(byStage).forEach((list) =>
      list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    );
    return byStage;
  }, [stages, deals]);

  const handleCreateDeal = async (firstStage: DealsPipelineStage | undefined) => {
    if (!companyId || !effectivePipelineId || !firstStage) return;
    setCreating(true);
    try {
      await createDeal(companyId, effectivePipelineId, firstStage.id, { title: 'Новая сделка' });
    } finally {
      setCreating(false);
    }
  };

  const handleCardDrop = async (
    deal: Deal,
    targetStageId: string,
    targetIndex: number
  ) => {
    try {
      const stage = stages.find((s) => s.id === targetStageId);
      await moveDealToStage(deal.companyId, deal.id, targetStageId, Date.now() + targetIndex, {
        name: stage?.name ?? 'Этап',
        color: stage?.color ?? null
      });
      if (import.meta.env.DEV) {
        console.log('[Deals] stage move success:', {
          dealId: deal.id,
          fromStageId: deal.stageId,
          toStageId: targetStageId
        });
      }
    } catch (err) {
      if (import.meta.env.DEV) {
        console.warn('[Deals] stage move failed:', err);
      }
    }
  };

  if (!companyId) {
    return (
      <div className="p-4">
        <p className="text-sm text-gray-500">Компания не привязана. Невозможно загрузить сделки.</p>
      </div>
    );
  }

  const loading = loadingPipelines || loadingStages || loadingDeals;

  useEffect(() => {
    if (!dealIdFromUrl) {
      setDetailDeal(null);
      return;
    }
    const d = deals.find((x) => x.id === dealIdFromUrl) ?? null;
    setDetailDeal(d);
  }, [dealIdFromUrl, deals]);

  const closeDetail = () => {
    searchParams.delete('deal');
    setSearchParams(searchParams, { replace: true });
    setDetailDeal(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-none px-4 py-3 border-b bg-white flex items-center gap-3">
        <h1 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          Сделки
        </h1>
        <div className="flex items-center gap-2">
          <select
            value={effectivePipelineId ?? ''}
            onChange={(e) => setSelectedPipelineId(e.target.value || null)}
            className="border border-gray-300 rounded-md px-2 py-1 text-sm"
          >
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              // TODO: модалка настройки воронки
            }}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            <Settings2 className="w-4 h-4" />
            Настроить воронку
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <input
            type="search"
            placeholder="Поиск по сделкам…"
            className="border border-gray-300 rounded-md px-2 py-1 text-sm w-48"
          />
          <button
            type="button"
            disabled={creating || stages.length === 0}
            onClick={() => handleCreateDeal(stages[0])}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            Новая сделка
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-gray-50">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <LoadingSpinner />
          </div>
        )}
        {!loading && pipelinesError && (
          <div className="p-4 text-sm text-red-600">Ошибка загрузки сделок: {pipelinesError}</div>
        )}
        {!loading && !pipelinesError && stages.length === 0 && (
          <div className="p-4 text-sm text-gray-500">
            Для этой компании ещё нет этапов воронки. Нажмите &quot;Настроить воронку&quot;, чтобы
            добавить этапы.
          </div>
        )}
        {!loading && !pipelinesError && stages.length > 0 && (
          <div className="flex gap-4 px-4 py-4 overflow-x-auto">
            {stages.map((stage) => {
              const items = groupedDeals[stage.id] ?? [];
              const totalAmount = items.reduce((sum, d) => sum + (d.amount ?? 0), 0);
              return (
                <div
                  key={stage.id}
                  className="flex-shrink-0 w-72 bg-gray-100 rounded-lg border border-gray-200 flex flex-col max-h-[calc(100vh-160px)]"
                >
                  <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{stage.name}</p>
                      <p className="text-xs text-gray-500">
                        {items.length} сделок · {totalAmount.toLocaleString('ru-RU')} ₸
                      </p>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
                    {items.map((deal, index) => (
                      <div
                        key={deal.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSearchParams({ deal: deal.id }, { replace: false })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ')
                            setSearchParams({ deal: deal.id }, { replace: false });
                        }}
                        className="bg-white rounded-md shadow-sm px-3 py-2 cursor-pointer hover:shadow-md transition-shadow text-sm"
                        draggable
                        onDragStart={(e) => {
                          e.stopPropagation();
                          e.dataTransfer.setData('text/plain', JSON.stringify({ dealId: deal.id }));
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          try {
                            const data = JSON.parse(
                              e.dataTransfer.getData('text/plain') || '{}'
                            ) as { dealId?: string };
                            if (!data.dealId) return;
                            const dragged = deals.find((d) => d.id === data.dealId);
                            if (!dragged || dragged.stageId === stage.id) return;
                            handleCardDrop(dragged, stage.id, index);
                          } catch {
                            // ignore
                          }
                        }}
                      >
                        <p className="font-medium text-gray-900 truncate">{deal.title}</p>
                        {deal.clientNameSnapshot && (
                          <p className="text-xs text-gray-600 truncate">
                            {deal.clientNameSnapshot}
                          </p>
                        )}
                        {deal.amount != null && (
                          <p className="text-xs text-gray-700 mt-0.5">
                            {deal.amount.toLocaleString('ru-RU')} ₸
                          </p>
                        )}
                      </div>
                    ))}
                    {items.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-4">
                        Нет сделок на этом этапе
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {detailDeal && (
        <div
          className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Карточка сделки"
        >
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-start gap-2">
              <h2 className="text-lg font-semibold text-gray-900 pr-8">{detailDeal.title}</h2>
              <button
                type="button"
                onClick={closeDetail}
                className="p-1 rounded-lg hover:bg-gray-100 shrink-0"
                aria-label="Закрыть"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {detailDeal.clientNameSnapshot && (
              <p className="text-sm text-gray-600 mt-1">{detailDeal.clientNameSnapshot}</p>
            )}
            {detailDeal.amount != null && (
              <p className="text-sm font-medium text-gray-800 mt-2">
                {detailDeal.amount.toLocaleString('ru-RU')} ₸
              </p>
            )}
            <div className="mt-4 p-3 rounded-lg bg-[#e7fce3] border border-green-200">
              <h3 className="text-xs font-semibold text-green-800 uppercase">Источник общения</h3>
              <p className="text-sm font-medium text-gray-900 mt-1 flex items-center gap-1">
                <MessageCircle className="w-4 h-4 text-green-600" />
                WhatsApp
              </p>
              {detailDeal.clientPhoneSnapshot && (
                <p className="text-sm text-gray-700 mt-1 font-mono">{detailDeal.clientPhoneSnapshot}</p>
              )}
              {detailDeal.whatsappConversationId ? (
                <Link
                  to={`/whatsapp?chatId=${detailDeal.whatsappConversationId}`}
                  className="mt-3 inline-flex items-center justify-center w-full py-2 rounded-lg bg-[#25D366] text-white text-sm font-medium hover:bg-[#20bd5a]"
                >
                  Открыть чат
                </Link>
              ) : (
                <p className="text-xs text-gray-500 mt-2">
                  Чат не привязан. Откройте диалог в WhatsApp и нажмите «Создать сделку» в карточке клиента.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DealsPage;

