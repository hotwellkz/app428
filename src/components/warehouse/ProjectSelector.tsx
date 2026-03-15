import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useCompanyId } from '../../contexts/CompanyContext';

interface Project {
  id: string;
  title: string;
}

interface ProjectSelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export const ProjectSelector: React.FC<ProjectSelectorProps> = ({ value, onChange }) => {
  const companyId = useCompanyId();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setProjects([]);
      setLoading(false);
      return;
    }
    const loadProjectsAndWarehouseCategories = async () => {
      try {
        // Категории только текущей компании (изоляция по companyId)
        const [projectsQuery, warehouseQuery] = [
          query(
            collection(db, 'categories'),
            where('companyId', '==', companyId),
            where('row', '==', 3)
          ),
          query(
            collection(db, 'categories'),
            where('companyId', '==', companyId),
            where('row', '==', 4),
            where('title', '==', 'Общ Расх')
          )
        ];
        
        const [projectsSnapshot, warehouseSnapshot] = await Promise.all([
          getDocs(projectsQuery),
          getDocs(warehouseQuery)
        ]);

        const projectsData = [
          // Добавляем категорию "Общ Расх" если она существует
          ...warehouseSnapshot.docs.map(doc => ({
            id: doc.id,
            title: doc.data().title,
            isVisible: true
          })),
          // Добавляем проекты
          ...projectsSnapshot.docs
            .map(doc => ({
              id: doc.id,
              title: doc.data().title,
              isVisible: doc.data().isVisible
            }))
            .filter(project => project.isVisible !== false)
        ].sort((a, b) => a.title.localeCompare(b.title));
        
        setProjects(projectsData);
      } catch (error) {
        console.error('Error loading projects:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProjectsAndWarehouseCategories();
  }, [companyId]);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 ${
        loading ? 'bg-gray-50' : 'bg-white'
      }`}
      disabled={loading}
    >
      <option value="">{loading ? 'Загрузка проектов...' : 'Выберите проект'}</option>
      {projects.map(project => (
        <option key={project.id} value={project.id}>
          {project.title}
        </option>
      ))}
    </select>
  );
};