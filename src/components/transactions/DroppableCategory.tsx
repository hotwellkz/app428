import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { CategoryCard } from './CategoryCard';
import { CategoryCardType } from '../../types';
import { ContextMenu } from '../ContextMenu';
import { PasswordPrompt } from '../PasswordPrompt';
import { EditPasswordModal } from '../EditPasswordModal';
import { EditCategoryModal } from '../EditCategoryModal';
import { useNavigate } from 'react-router-dom';
import { showErrorNotification } from '../../utils/notifications';
import { ClientTooltip } from './ClientTooltip';

interface DroppableCategoryProps {
  category: CategoryCardType;
  onEdit?: () => void;
  onDelete?: () => void;
  onHistoryClick?: () => void;
  /** Скрыть сумму (например, для чужих карточек сотрудников при ограничении прав). */
  maskAmount?: boolean;
}

export const DroppableCategory: React.FC<DroppableCategoryProps> = ({
  category,
  onEdit,
  onDelete,
  maskAmount,
}) => {
  console.log('DroppableCategory получил onDelete:', !!onDelete, 'для категории:', category.title);
  const navigate = useNavigate();
  const { setNodeRef, isOver, active } = useDroppable({
    id: category.id,
    data: category
  });

  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [isHistoryPasswordPromptOpen, setIsHistoryPasswordPromptOpen] = useState(false);
  const [showClientInfo, setShowClientInfo] = useState(false);

  const handleViewHistory = () => {
    if (category.title === 'ЗП Сот.') {
      setIsHistoryPasswordPromptOpen(true);
    } else {
      const routeId = category.id;
      const fullRoute = `/transactions/history/${routeId}`;
      if (process.env.NODE_ENV === 'development') {
        console.log('OPEN PROJECT HISTORY', {
          title: category.title,
          routeId,
          fullRoute,
          sourceCollection: 'categories (DroppableCategory → category from CategoryRow → projectCategories/visibleCategories)',
          fullObject: { id: category.id, title: category.title, row: category.row, isVisible: category.isVisible }
        });
      }
      navigate(fullRoute);
    }
    setShowContextMenu(false);
  };

  const handleHistoryPasswordSuccess = () => {
    setIsHistoryPasswordPromptOpen(false);
    const routeId = category.id;
    if (process.env.NODE_ENV === 'development') {
      console.log('OPEN PROJECT HISTORY (after password)', { title: category.title, routeId, fullRoute: `/transactions/history/${routeId}` });
    }
    navigate(`/transactions/history/${routeId}`);
  };

  const handleEdit = () => {
    setShowContextMenu(false);
    if (onEdit) {
      setShowPasswordPrompt(true);
    } else {
      showErrorNotification('Редактирование недоступно');
    }
  };

  const handleDelete = () => {
    console.log('Вызван handleDelete в DroppableCategory, onDelete =', !!onDelete);
    if (onDelete) {
      // Вызываем функцию удаления напрямую, без модального окна
      console.log('Вызываем onDelete в DroppableCategory');
      onDelete();
      setShowContextMenu(false);
    } else {
      console.log('Функция onDelete не передана, показываем уведомление');
      showErrorNotification('Удаление недоступно');
      setShowContextMenu(false);
    }
  };

  const handleViewClientInfo = () => {
    setShowClientInfo(true);
    setShowContextMenu(false);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const viewportWidth = window.innerWidth;
    const x = Math.min(e.clientX, viewportWidth - 200);
    setContextMenuPosition({ x, y: e.clientY });
    setShowContextMenu(true);
  };

  const handleCloseContextMenu = () => {
    setShowContextMenu(false);
  };

  return (
    <>
      <div
        ref={setNodeRef}
        className={`relative ${isOver && active ? 'ring-2 ring-emerald-500 rounded-lg' : ''}`}
        onContextMenu={handleContextMenu}
      >
        <CategoryCard
          category={category}
          onHistoryClick={handleViewHistory}
          maskAmount={maskAmount}
        />
      </div>

      {showContextMenu && (
        <ContextMenu
          position={contextMenuPosition}
          onClose={handleCloseContextMenu}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onViewHistory={handleViewHistory}
          onViewClientInfo={handleViewClientInfo}
          title={category.title}
          showClientInfo={category.title === "Projects"}
        />
      )}

      {showPasswordPrompt && onEdit && (
        <EditPasswordModal
          isOpen={showPasswordPrompt}
          onClose={() => setShowPasswordPrompt(false)}
          onSuccess={() => {
            setShowPasswordPrompt(false);
            setShowEditModal(true);
          }}
        />
      )}

      {showEditModal && (
        <EditCategoryModal
          category={category}
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            // Обновляем данные после редактирования
            if (onEdit) {
              onEdit();
            }
          }}
        />
      )}

      {isHistoryPasswordPromptOpen && (
        <PasswordPrompt
          isOpen={isHistoryPasswordPromptOpen}
          onClose={() => setIsHistoryPasswordPromptOpen(false)}
          onSuccess={handleHistoryPasswordSuccess}
        />
      )}

      {showClientInfo && (
        <ClientTooltip
          objectName={category.title}
          show={showClientInfo}
          onClose={() => setShowClientInfo(false)}
        />
      )}
    </>
  );
};