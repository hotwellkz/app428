import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Search, X, CheckCircle2, ExternalLink, FolderOpen } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useCompanyId } from '../../contexts/CompanyContext';
import type { CrmAiBotExtractionResult } from '../../types/crmAiBotExtraction';
import type {
  CrmApplyFieldAction,
  CrmApplyPreviewResult,
  CrmClientPickRow
} from '../../types/crmExtractionApply';
import { buildCrmApplyPreview, previewHasWritableChanges } from '../../lib/autovoronki/extractionCrmMapper';
import { fetchCompanyClientsForPicker, filterClientPickRows } from '../../lib/autovoronki/crmClientSearch';
import { applyExtractionToClientDoc, loadClientDocForCompany } from '../../lib/autovoronki/applyCrmExtraction';

function actionLabel(a: CrmApplyFieldAction): string {
  switch (a) {
    case 'new':
      return 'Новое';
    case 'replace':
      return 'Замена';
    case 'append':
      return 'Дополнение';
    case 'unchanged':
      return 'Без изм.';
    case 'skipped':
      return 'Пропуск';
    default:
      return a;
  }
}

function actionBadgeClass(a: CrmApplyFieldAction): string {
  switch (a) {
    case 'new':
      return 'bg-emerald-100 text-emerald-900 border-emerald-200';
    case 'replace':
      return 'bg-amber-100 text-amber-900 border-amber-200';
    case 'append':
      return 'bg-sky-100 text-sky-900 border-sky-200';
    case 'unchanged':
      return 'bg-gray-100 text-gray-600 border-gray-200';
    case 'skipped':
      return 'bg-slate-50 text-slate-500 border-slate-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

export interface ApplyExtractionToClientModalProps {
  open: boolean;
  onClose: () => void;
  extraction: CrmAiBotExtractionResult;
  onApplied?: (payload: { clientId: string; displayName: string; extractionKey: string }) => void;
}

export const ApplyExtractionToClientModal: React.FC<ApplyExtractionToClientModalProps> = ({
  open,
  onClose,
  extraction,
  onApplied
}) => {
  const companyId = useCompanyId();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [allRows, setAllRows] = useState<CrmClientPickRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [selected, setSelected] = useState<CrmClientPickRow | null>(null);
  const [preview, setPreview] = useState<CrmApplyPreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [doneClient, setDoneClient] = useState<{ id: string; name: string } | null>(null);

  const filtered = useMemo(() => filterClientPickRows(allRows, search), [allRows, search]);

  const resetInner = useCallback(() => {
    setSearch('');
    setSelected(null);
    setPreview(null);
    setDoneClient(null);
  }, []);

  useEffect(() => {
    if (!open || !companyId) return;
    resetInner();
    let cancelled = false;
    setListLoading(true);
    fetchCompanyClientsForPicker(companyId)
      .then((rows) => {
        if (!cancelled) setAllRows(rows);
      })
      .catch(() => {
        if (!cancelled) {
          toast.error('Не удалось загрузить список клиентов');
          setAllRows([]);
        }
      })
      .finally(() => {
        if (!cancelled) setListLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, companyId, resetInner]);

  const handleSelectClient = async (row: CrmClientPickRow) => {
    if (!companyId) return;
    setSelected(row);
    setPreview(null);
    setPreviewLoading(true);
    try {
      const data = await loadClientDocForCompany(row.id, companyId);
      if (!data) {
        toast.error('Не удалось загрузить карточку');
        setSelected(null);
        return;
      }
      setPreview(buildCrmApplyPreview(extraction, data));
    } catch {
      toast.error('Ошибка загрузки карточки');
      setSelected(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleConfirmApply = async () => {
    if (!companyId || !selected || !preview) return;
    if (!previewHasWritableChanges(preview)) {
      toast.error('Нет изменений для записи');
      return;
    }
    setApplyLoading(true);
    try {
      await applyExtractionToClientDoc(selected.id, companyId, extraction);
      const name = selected.displayName;
      setDoneClient({ id: selected.id, name });
      toast.success(`Данные записаны в карточку: ${name}`);
      onApplied?.({
        clientId: selected.id,
        displayName: name,
        extractionKey: JSON.stringify(extraction)
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Не удалось сохранить');
    } finally {
      setApplyLoading(false);
    }
  };

  const handleBack = () => {
    setSelected(null);
    setPreview(null);
    setDoneClient(null);
  };

  if (!open) return null;

  const body = (
    <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
        aria-label="Закрыть"
        onClick={onClose}
      />
      <div
        className="relative w-full sm:max-w-lg max-h-[92vh] sm:max-h-[85vh] rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="apply-extraction-title"
      >
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-violet-50/80 to-white">
          <div className="min-w-0">
            <h2 id="apply-extraction-title" className="text-base font-semibold text-gray-900">
              Применить извлечение в CRM
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Только после предпросмотра и подтверждения. Коллекция <span className="font-mono">clients</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {!companyId && <p className="text-sm text-amber-700">Компания не выбрана.</p>}

          {doneClient && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 p-4 space-y-3">
              <div className="flex items-center gap-2 text-emerald-900 font-medium text-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                Записано в карточку
              </div>
              <p className="text-sm text-emerald-900/90">{doneClient.name}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigate('/clients');
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 text-white px-3 py-2 text-xs font-medium hover:bg-emerald-800"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  К списку клиентов
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigate(`/clients/${doneClient.id}/files`);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white text-emerald-900 px-3 py-2 text-xs font-medium hover:bg-emerald-50"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Файлы клиента
                </button>
              </div>
            </div>
          )}

          {!doneClient && (
            <>
              {!selected && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-600">Поиск клиента</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Имя, объект, телефон…"
                      className="w-full rounded-xl border border-gray-200 pl-10 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-500 outline-none"
                    />
                  </div>
                  {listLoading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500 py-8 justify-center">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Загрузка…
                    </div>
                  ) : (
                    <ul className="rounded-xl border border-gray-200 divide-y divide-gray-100 max-h-[220px] overflow-y-auto">
                      {filtered.length === 0 ? (
                        <li className="px-3 py-6 text-center text-sm text-gray-400">Никого не найдено</li>
                      ) : (
                        filtered.map((r) => (
                          <li key={r.id}>
                            <button
                              type="button"
                              onClick={() => void handleSelectClient(r)}
                              className="w-full text-left px-3 py-2.5 hover:bg-violet-50/80 transition-colors"
                            >
                              <div className="text-sm font-medium text-gray-900 truncate">{r.displayName}</div>
                              <div className="text-xs text-gray-500 flex flex-wrap gap-x-2">
                                {r.phone && <span>{r.phone}</span>}
                                {r.subtitle && <span className="truncate">{r.subtitle}</span>}
                              </div>
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  )}
                </div>
              )}

              {selected && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500">Выбрано</p>
                      <p className="text-sm font-semibold text-gray-900 truncate">{selected.displayName}</p>
                      {selected.phone && <p className="text-xs text-gray-500">{selected.phone}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={handleBack}
                      className="shrink-0 text-xs font-medium text-violet-700 hover:underline"
                    >
                      Изменить
                    </button>
                  </div>

                  {previewLoading && (
                    <div className="flex items-center gap-2 text-sm text-gray-500 py-6 justify-center">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Считаем предпросмотр…
                    </div>
                  )}

                  {preview && !previewLoading && (
                    <>
                      {preview.infoRows.length > 0 && (
                        <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 space-y-1.5">
                          {preview.infoRows.map((row, i) => (
                            <div key={i} className="text-xs text-slate-600">
                              <span className="font-medium text-slate-700">{row.label}: </span>
                              {row.value}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="rounded-xl border border-gray-200 overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-gray-50 text-gray-600 text-left">
                            <tr>
                              <th className="px-2 py-2 font-medium">Поле</th>
                              <th className="px-2 py-2 font-medium hidden sm:table-cell">Было</th>
                              <th className="px-2 py-2 font-medium">Станет</th>
                              <th className="px-2 py-2 font-medium w-[72px]">Действие</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {preview.rows.map((row) => (
                              <tr key={row.fieldKey} className="align-top">
                                <td className="px-2 py-2 font-medium text-gray-800">{row.label}</td>
                                <td className="px-2 py-2 text-gray-500 whitespace-pre-wrap break-words max-w-[120px] hidden sm:table-cell">
                                  {row.beforeDisplay}
                                </td>
                                <td className="px-2 py-2 text-gray-900 whitespace-pre-wrap break-words max-w-[140px]">
                                  <span className="sm:hidden text-[10px] text-gray-400 block mb-0.5">Было: {row.beforeDisplay}</span>
                                  {row.afterDisplay}
                                </td>
                                <td className="px-2 py-2">
                                  <span
                                    className={`inline-flex px-1.5 py-0.5 rounded-md border text-[10px] font-semibold ${actionBadgeClass(row.action)}`}
                                  >
                                    {actionLabel(row.action)}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {!previewHasWritableChanges(preview) && (
                        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                          Нет полей для записи: извлечение пустое относительно этой карточки или всё совпадает.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {!doneClient && selected && preview && !previewLoading && (
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button
              type="button"
              onClick={handleBack}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Назад
            </button>
            <button
              type="button"
              disabled={applyLoading || !previewHasWritableChanges(preview)}
              onClick={() => void handleConfirmApply()}
              className="rounded-xl bg-violet-600 text-white px-4 py-2.5 text-sm font-medium hover:bg-violet-700 disabled:opacity-45 disabled:pointer-events-none inline-flex items-center justify-center gap-2"
            >
              {applyLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Запись…
                </>
              ) : (
                'Подтвердить и записать'
              )}
            </button>
          </div>
        )}

        {doneClient && (
          <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-gray-900 text-white px-4 py-2.5 text-sm font-medium hover:bg-gray-800"
            >
              Закрыть
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(body, document.body) : null;
};
