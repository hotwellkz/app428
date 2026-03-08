import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { contractTemplateService } from '../services/contractTemplateService';
import { ContractTemplate } from '../types/contract';
import { Plus, Eye, Search, FileText, Edit, Trash2, ArrowLeft, Menu } from 'lucide-react';
import { PageContainer } from '../components/layout/PageContainer';
import { useMobileSidebar } from '../contexts/MobileSidebarContext';
import { HeaderSearchBar } from '../components/HeaderSearchBar';
import { useCompanyId } from '../contexts/CompanyContext';

export const ContractTemplates: React.FC = () => {
  const navigate = useNavigate();
  const companyId = useCompanyId();
  const { toggle: toggleMobileSidebar } = useMobileSidebar();
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<ContractTemplate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setTemplates([]);
      setFilteredTemplates([]);
      setIsLoading(false);
      return;
    }
    loadTemplates();
  }, [companyId]);

  useEffect(() => {
    filterTemplates();
  }, [searchQuery, templates]);

  const loadTemplates = async () => {
    if (!companyId) return;
    try {
      setIsLoading(true);
      const loadedTemplates = await contractTemplateService.getTemplates(companyId);
      setTemplates(loadedTemplates);
      setFilteredTemplates(loadedTemplates);
    } catch (error) {
      console.error('Ошибка при загрузке шаблонов:', error);
      alert('Произошла ошибка при загрузке шаблонов');
    } finally {
      setIsLoading(false);
    }
  };

  const filterTemplates = () => {
    const query = searchQuery.toLowerCase();
    const filtered = templates.filter(template => 
      template.title.toLowerCase().includes(query) ||
      template.description.toLowerCase().includes(query)
    );
    setFilteredTemplates(filtered);
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!window.confirm('Вы уверены, что хотите удалить этот шаблон?')) {
      return;
    }

    try {
      await contractTemplateService.deleteTemplate(id);
      setTemplates(templates.filter(template => template.id !== id));
    } catch (error) {
      console.error('Ошибка при удалении шаблона:', error);
      alert('Произошла ошибка при удалении шаблона');
    }
  };

  const handlePreviewTemplate = async (template: ContractTemplate) => {
    try {
      await contractTemplateService.previewTemplate(template);
    } catch (error) {
      console.error('Ошибка при предпросмотре шаблона:', error);
      alert('Произошла ошибка при предпросмотре шаблона');
    }
  };

  return (
    <PageContainer>
      {/* Header: как на Feed — [бургер][назад] | Шаблоны | [🔍][+]; sticky на mobile */}
      <div
        className="sticky md:static top-0 z-[100] md:z-auto bg-white min-h-[56px] md:min-h-0"
        style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb' }}
      >
        <HeaderSearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Поиск шаблонов..."
          onClose={() => {
            setSearchQuery('');
            setShowSearch(false);
          }}
          isOpen={showSearch}
          mobileOnly
        />
        <div
          className="flex items-center min-h-[56px] h-14 px-3 md:px-6 md:py-4 md:h-auto max-w-7xl mx-auto"
          style={{ paddingLeft: '12px', paddingRight: '12px' }}
        >
          <div className="flex items-center gap-2 md:gap-4 flex-shrink-0 w-[96px] md:w-auto md:min-w-0" style={{ gap: '8px' }}>
            <button
              type="button"
              onClick={toggleMobileSidebar}
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-[10px] hover:bg-gray-100 transition-colors flex-shrink-0"
              style={{ color: '#374151' }}
              aria-label="Меню"
            >
              <Menu className="w-6 h-6" style={{ width: 24, height: 24 }} />
            </button>
            <button
              onClick={() => {
                if (showSearch) {
                  setShowSearch(false);
                  setSearchQuery('');
                } else {
                  window.history.back();
                }
              }}
              className="flex items-center justify-center w-10 h-10 md:w-auto md:h-auto md:min-w-0 p-2 md:mr-0 flex-shrink-0"
              style={{ color: '#374151' }}
              aria-label="Назад"
            >
              <ArrowLeft className="w-6 h-6" style={{ width: 24, height: 24 }} />
            </button>
            <h1
              className="hidden md:block text-xl font-semibold text-gray-900"
              style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: '20px', fontWeight: 600, color: '#111827' }}
            >
              Шаблоны договоров
            </h1>
          </div>

          <div className="flex-1 flex items-center justify-center min-w-0 md:hidden">
            <h1
              className="text-center truncate"
              style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: '18px', fontWeight: 600, color: '#111827' }}
            >
              Шаблоны
            </h1>
          </div>

          <div className="flex items-center flex-shrink-0 md:ml-auto" style={{ gap: '8px' }}>
            <button
              type="button"
              onClick={() => setShowSearch(!showSearch)}
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-[10px] hover:bg-gray-100 transition-colors"
              style={{ color: '#374151' }}
              aria-label="Поиск"
            >
              <Search className="w-6 h-6" style={{ width: 24, height: 24 }} />
            </button>
            <button
              onClick={() => navigate('/templates/create')}
              className="flex items-center justify-center w-10 h-10 rounded-[10px] text-white transition-colors md:w-auto md:h-auto md:p-2"
              style={{ background: '#22c55e' }}
              title="Создать шаблон"
              aria-label="Создать шаблон"
            >
              <Plus className="w-6 h-6 md:w-5 md:h-5" style={{ width: 24, height: 24 }} />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Поиск в контенте — только на desktop; на mobile поиск в header */}
            <div className="flex flex-col gap-4 hidden md:block">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск шаблонов..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {filteredTemplates.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                  <FileText className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">Шаблоны не найдены</h3>
                <p className="text-gray-500">
                  {searchQuery ? 'Попробуйте изменить параметры поиска' : 'Создайте свой первый шаблон'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200"
                  >
                    <div className="p-4">
                      <h3 className="text-lg font-semibold mb-2 text-gray-900">{template.title}</h3>
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2">{template.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">
                          {new Date(template.lastModified).toLocaleDateString()}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handlePreviewTemplate(template)}
                            className="p-2 text-emerald-600 hover:text-emerald-700 transition-colors"
                            title="Предпросмотр"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                          <Link
                            to={`/templates/${template.id}/create-with-additional`}
                            className="p-2 text-blue-600 hover:text-blue-700 transition-colors"
                            title="Создать договор"
                          >
                            <FileText className="w-5 h-5" />
                          </Link>
                          <Link
                            to={`/templates/${template.id}/edit`}
                            className="p-2 text-blue-600 hover:text-blue-700 transition-colors"
                            title="Редактировать"
                          >
                            <Edit className="w-5 h-5" />
                          </Link>
                          <button
                            onClick={() => handleDeleteTemplate(template.id)}
                            className="p-2 text-red-600 hover:text-red-700 transition-colors"
                            title="Удалить"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  );
};