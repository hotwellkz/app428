import React, { useState, useCallback, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { CalculatorForm } from '../calculator/CalculatorForm';
import { CommercialProposal, COMMERCIAL_PROPOSAL_THEMES, type CommercialProposalThemeId } from '../calculator/CommercialProposal';
import { CalculationResult } from '../../types/calculator';
import html2canvas from 'html2canvas';

const CACHE_KEY = 'whatsapp_calculator_cache';
const KP_CAPTURE_ID = 'wa-kp-capture';
const KP_RENDER_ID = 'commercial-offer-render';
/** Блок самого документа КП — захват по нему обрезает изображение по границам без белых полей. */
const KP_DOCUMENT_ID = 'commercial-offer-document';
const CAPTION =
  'Ваше коммерческое предложение по дому из SIP-панелей.\nЕсли будут вопросы — напишите 👍';

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
  const [simpleMode, setSimpleMode] = useState(true);
  const [sendingProposal, setSendingProposal] = useState(false);
  const [theme, setTheme] = useState<CommercialProposalThemeId>('light');
  const captureRef = useRef<HTMLDivElement>(null);

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
      const node =
        document.getElementById(KP_DOCUMENT_ID) ||
        document.getElementById(KP_RENDER_ID) ||
        document.getElementById(KP_CAPTURE_ID);
      if (!node) {
        console.error('KP capture: node not found', { KP_DOCUMENT_ID, KP_RENDER_ID, KP_CAPTURE_ID });
        throw new Error('Capture container not found');
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

      const rect = node.getBoundingClientRect();
      const width = Math.ceil(rect.width);
      const height = Math.ceil(rect.height);
      if (width <= 0 || height <= 0) {
        throw new Error('Размер блока КП некорректен');
      }
      if (import.meta.env.DEV) {
        console.log('KP capture node', {
          id: node.id,
          width,
          height,
          innerHTMLLength: node.innerHTML?.length ?? 0,
          total: finalResult.total
        });
      }

      const canvas = await html2canvas(node, {
        width,
        height,
        scale: 2,
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
      await onSendProposalImage(blob, CAPTION);
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

  return (
    <>
      <div
        className="fixed inset-0 z-[1100] bg-black/30"
        onClick={onClose}
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
            <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-200">
              <p className="text-sm font-medium text-gray-800">
                Итого: {new Intl.NumberFormat('ru-RU').format(finalResult.total)} ₸
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                Площадь: {area} м² · {new Intl.NumberFormat('ru-RU').format(finalResult.pricePerSqm)} ₸/м²
              </p>
            </div>
          )}
        </div>

        <div className="flex-none flex flex-col gap-2 p-4 border-t border-gray-200">
          <p className="text-xs text-gray-500 mb-1">
            Расчёт обновляется при изменении параметров.
          </p>
          <button
            type="button"
            onClick={handleSendProposal}
            disabled={finalResult.total <= 0 || sendingProposal}
            className="w-full py-2.5 rounded-xl bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium text-sm"
          >
            {sendingProposal ? 'Отправка…' : 'Отправить коммерческое предложение'}
          </button>
        </div>
      </div>

      {/* Блок для рендера КП вне экрана (без visibility:hidden — иначе html2canvas даёт белый кадр). Без minHeight — обрезка по контенту. */}
      <div
        id={KP_CAPTURE_ID}
        ref={captureRef}
        className="fixed top-0 z-[-1] overflow-visible bg-white"
        style={{
          left: -10000,
          width: 1080,
          background: '#ffffff',
          color: '#111',
          margin: 0,
          padding: 0
        }}
      >
        <div
          id={KP_RENDER_ID}
          style={{
            width: 1080,
            background: '#ffffff',
            margin: 0,
            padding: 0,
            display: 'inline-block'
          }}
        >
          <CommercialProposal
            area={area}
            parameters={paramsForProposal}
            result={finalResult}
            options={options}
            captureId={KP_DOCUMENT_ID}
            presetTheme={theme}
          />
        </div>
      </div>
    </>
  );
};
