import React, { useState, useCallback, useEffect } from 'react';
import { X, Pencil } from 'lucide-react';
import { CalculatorForm } from '../calculator/CalculatorForm';
import { CommercialProposal, COMMERCIAL_PROPOSAL_THEMES, type CommercialProposalThemeId } from '../calculator/CommercialProposal';
import { CalculationResult } from '../../types/calculator';
import html2canvas from 'html2canvas';

const CACHE_KEY = 'whatsapp_calculator_cache';
/** Единый блок КП: id для превью в drawer и для захвата при отправке в чат. */
const KP_OFFER_IMAGE_ID = 'offer-image';
const DEFAULT_CAPTION =
  'Ваше коммерческое предложение по дому из SIP-панелей.\nЕсли будут вопросы — напишите 👍';

const KP_MESSAGE_TEMPLATE_KEY = 'crm_kp_message_template';
const LAST_CALCULATOR_MODE_KEY = 'lastCalculatorMode';

function getStoredCaption(): string {
  try {
    const stored = localStorage.getItem(KP_MESSAGE_TEMPLATE_KEY);
    return (stored && stored.trim()) ? stored : DEFAULT_CAPTION;
  } catch {
    return DEFAULT_CAPTION;
  }
}

function applyAdditionalCharges(
  base: CalculationResult,
  options: { isVatIncluded: boolean; isInstallment: boolean; installmentAmount: number }
): CalculationResult {
  let total = base.total;
  if (options.isVatIncluded) total += total * 0.16;
  if (options.isInstallment) {
    if (options.installmentAmount > 0) total += options.installmentAmount * 0.17;
    else total += total * 0.17;
  }
  return { ...base, total: Math.round(total) };
}

function loadCache(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function saveCache(data: Record<string, unknown>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

export interface WhatsAppCalculatorDrawerProps {
  open: boolean;
  onClose: () => void;
  onSendProposalImage: (blob: Blob, caption: string) => Promise<void>;
  isMobile?: boolean;
}

export const WhatsAppCalculatorDrawer: React.FC<WhatsAppCalculatorDrawerProps> = ({
  open,
  onClose,
  onSendProposalImage,
  isMobile = false
}) => {
  const [calculationResult, setCalculationResult] = useState<CalculationResult>({
    fundamentCost: 0,
    kitCost: 0,
    assemblyCost: 0,
    total: 0,
    pricePerSqm: 0
  });
  const [area, setArea] = useState(0);
  const [parameters, setParameters] = useState<Record<string, unknown>>({});
  const [options, setOptions] = useState({
    isVatIncluded: false,
    isInstallment: false,
    installmentAmount: 0,
    hideFundamentCost: false,
    hideKitCost: false,
    hideAssemblyCost: false,
    hideDeliveryCost: false
  });
  const [simpleMode, setSimpleMode] = useState(() => {
    try {
      const saved = localStorage.getItem(LAST_CALCULATOR_MODE_KEY);
      if (saved === 'simple') return true;
      if (saved === 'professional') return false;
    } catch {
      // ignore
    }
    return false; // по умолчанию — профессиональный
  });
  const [sendingProposal, setSendingProposal] = useState(false);
  const [theme, setTheme] = useState<CommercialProposalThemeId>('light');
  const [showEditCaptionModal, setShowEditCaptionModal] = useState(false);
  const [editCaptionDraft, setEditCaptionDraft] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(LAST_CALCULATOR_MODE_KEY, simpleMode ? 'simple' : 'professional');
    } catch {
      // ignore
    }
  }, [simpleMode]);

  // Кэш подставляем при рендере, чтобы форма получила его до первого эффекта и не затирала STANDARD_DEFAULTS
  const initialValues: Record<string, unknown> | undefined = open
    ? (() => {
        const cached = loadCache();
        return cached?.parameters && typeof cached.parameters === 'object'
          ? (cached.parameters as Record<string, unknown>)
          : undefined;
      })()
    : undefined;

  const handleCalculationChange = useCallback((result: CalculationResult, newArea: number) => {
    setCalculationResult(result);
    setArea(newArea);
  }, []);

  const handleOptionsChange = useCallback(
    (newOptions: {
      isVatIncluded: boolean;
      isInstallment: boolean;
      installmentAmount: number;
      hideFundamentCost: boolean;
      hideKitCost: boolean;
      hideAssemblyCost: boolean;
      hideDeliveryCost: boolean;
    }) => {
      setOptions(newOptions);
      saveCache({ parameters, options: newOptions });
    },
    [parameters]
  );

  const handleParametersChange = useCallback((params: Record<string, unknown>) => {
    setParameters(params);
    saveCache({ parameters: params, options });
  }, [options]);

  const finalResult = applyAdditionalCharges(calculationResult, options);

  const handleSendProposal = useCallback(async () => {
    if (finalResult.total <= 0) return;
    setSendingProposal(true);
    try {
      const node = document.getElementById(KP_OFFER_IMAGE_ID);
      if (!node) {
        console.error('KP capture: node not found (id=', KP_OFFER_IMAGE_ID, ')');
        throw new Error('Блок КП не найден. Прокрутите до предпросмотра и попробуйте снова.');
      }

      await document.fonts.ready;
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      });

      const imgs = node.querySelectorAll('img');
      await Promise.all(
        Array.from(imgs).map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) {
                resolve();
                return;
              }
              img.onload = () => resolve();
              img.onerror = () => resolve();
            })
        )
      );

      const logoImg = node.querySelector('.logo img');
      if (logoImg) {
        await new Promise<void>((resolve) => {
          const img = logoImg as HTMLImageElement;
          if (img.complete) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        });
      }
      node.scrollIntoView({ block: 'start', behavior: 'instant' });
      await new Promise<void>((r) => setTimeout(r, 500));

      const width = node.offsetWidth || Math.ceil(node.getBoundingClientRect().width);
      const height = node.offsetHeight || Math.ceil(node.getBoundingClientRect().height);
      if (width <= 0 || height <= 0) {
        throw new Error('Размер блока КП некорректен. Убедитесь, что предпросмотр КП виден на экране.');
      }
      if (import.meta.env.DEV) {
        console.log('KP capture node', { id: node.id, width, height, total: finalResult.total });
      }

      const canvas = await html2canvas(node, {
        width,
        height,
        scale: 2,
        windowWidth: width,
        windowHeight: height,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        allowTaint: true
      });

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('toBlob failed'))),
          'image/jpeg',
          0.95
        );
      });
      const caption = getStoredCaption();
      await onSendProposalImage(blob, caption);
    } catch (e) {
      console.error('KP image generation failed', e);
    } finally {
      setSendingProposal(false);
    }
  }, [finalResult.total, onSendProposalImage]);

  if (!open) return null;

  const paramsForProposal = {
    foundation: parameters.foundation as string,
    floors: parameters.floors as string,
    firstFloorType: parameters.firstFloorType as string | undefined,
    secondFloorType: parameters.secondFloorType as string | undefined,
    thirdFloorType: parameters.thirdFloorType as string | undefined,
    firstFloorHeight: (parameters.firstFloorHeight as string) ?? '',
    secondFloorHeight: (parameters.secondFloorHeight as string) ?? undefined,
    thirdFloorHeight: (parameters.thirdFloorHeight as string) ?? undefined,
    firstFloorThickness: (parameters.firstFloorThickness as string) ?? '',
    secondFloorThickness: (parameters.secondFloorThickness as string) ?? undefined,
    thirdFloorThickness: (parameters.thirdFloorThickness as string) ?? undefined,
    partitionType: (parameters.partitionType as string) ?? '',
    ceiling: (parameters.ceiling as string) ?? '',
    roofType: (parameters.roofType as string) ?? '',
    houseShape: (parameters.houseShape as string) ?? '',
    additionalWorks: (parameters.additionalWorks as string) ?? '',
    useCustomWorks: (parameters.useCustomWorks as boolean) ?? false,
    customWorks: (parameters.customWorks as Array<{ name: string; price: number | string }>) ?? [],
    deliveryCity: (parameters.deliveryCity as string) ?? undefined
  };

  // На desktop оверлей не перехватывает события — чат остаётся скроллируемым и кликабельным (side panel UX).
  // На mobile оверлей закрывает по клику (модальное поведение).
  const backdropClass = isMobile
    ? 'fixed inset-0 z-[1100] bg-black/30'
    : 'fixed inset-0 z-[1100] bg-black/30 pointer-events-none';

  return (
    <>
      <div
        className={backdropClass}
        onClick={isMobile ? onClose : undefined}
        aria-hidden
      />
      <div
        className={`fixed z-[1110] bg-white border border-gray-200 shadow-xl flex flex-col ${
          isMobile
            ? 'inset-x-0 bottom-0 top-[15%] rounded-t-2xl'
            : 'top-0 right-0 bottom-0 w-[min(100vw,560px)] border-l'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-none flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-800">
            Калькулятор стоимости строительства
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-none flex flex-wrap items-center gap-2 px-4 py-2 border-b border-gray-100">
          <span className="text-sm text-gray-600">Режим:</span>
          <button
            type="button"
            onClick={() => setSimpleMode(true)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              simpleMode ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
            }`}
          >
            Простой
          </button>
          <button
            type="button"
            onClick={() => setSimpleMode(false)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              !simpleMode ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
            }`}
          >
            Профессиональный
          </button>
          <label htmlFor="themeSelector" className="text-sm text-gray-600 ml-2 mr-1 form-label">Тема оформления</label>
          <select
            id="themeSelector"
            value={theme}
            onChange={(e) => setTheme(e.target.value as CommercialProposalThemeId)}
            className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm bg-white text-gray-800"
          >
            {COMMERCIAL_PROPOSAL_THEMES.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <CalculatorForm
            onCalculationChange={handleCalculationChange}
            onOptionsChange={handleOptionsChange}
            onParametersChange={handleParametersChange}
            isAdvancedMode={!simpleMode}
            initialValues={initialValues as any}
          />
          {finalResult.total > 0 && (
            <>
              <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                <p className="text-sm font-medium text-gray-800">
                  Итого: {new Intl.NumberFormat('ru-RU').format(finalResult.total)} ₸
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  Площадь: {area} м² · {new Intl.NumberFormat('ru-RU').format(finalResult.pricePerSqm)} ₸/м²
                </p>
              </div>
              {/* Единый источник КП: тот же блок для превью и для захвата в изображение при отправке в чат */}
              <div className="overflow-x-auto -mx-4 px-4" style={{ maxWidth: '100%' }}>
                <div style={{ width: 1080, minHeight: 1 }}>
                  <CommercialProposal
                    area={area}
                    parameters={paramsForProposal}
                    result={finalResult}
                    options={options}
                    captureId={KP_OFFER_IMAGE_ID}
                    presetTheme={theme}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex-none flex flex-col gap-2 p-4 border-t border-gray-200">
          <p className="text-xs text-gray-500 mb-1">
            Расчёт обновляется при изменении параметров.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSendProposal}
              disabled={finalResult.total <= 0 || sendingProposal}
              className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium text-sm"
            >
              {sendingProposal ? 'Отправка…' : 'Отправить коммерческое предложение'}
            </button>
            {!simpleMode && (
              <button
                type="button"
                onClick={() => {
                  setEditCaptionDraft(getStoredCaption());
                  setShowEditCaptionModal(true);
                }}
                className="flex-none p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                title="Редактировать текст сообщения после отправки КП"
                aria-label="Редактировать текст сообщения после КП"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {showEditCaptionModal && (
          <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-black/40" onClick={() => setShowEditCaptionModal(false)}>
            <div
              className="bg-white rounded-xl shadow-lg w-full max-w-[480px] p-4 flex flex-col gap-3"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-semibold text-gray-800">
                Текст сообщения после отправки КП
              </h3>
              <textarea
                value={editCaptionDraft}
                onChange={(e) => setEditCaptionDraft(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 placeholder-gray-400 resize-y min-h-[80px]"
                placeholder={DEFAULT_CAPTION}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditCaptionModal(false)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      localStorage.setItem(KP_MESSAGE_TEMPLATE_KEY, editCaptionDraft.trim() || DEFAULT_CAPTION);
                    } catch {
                      // ignore
                    }
                    setShowEditCaptionModal(false);
                  }}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700"
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

    </>
  );
};
