import React, { useState } from 'react';
import { ArrowLeft, Plus, Menu, Search, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useMobileSidebar } from '../contexts/MobileSidebarContext';
import { HeaderSearchBar } from '../components/HeaderSearchBar';
import { Employee, EmployeeFormData } from '../types/employee';
import { EmployeeList } from '../components/employees/EmployeeList';
import { EmployeeForm } from '../components/employees/EmployeeForm';
import { DeleteEmployeeModal } from '../components/employees/DeleteEmployeeModal';
import { InviteUserModal } from '../components/employees/InviteUserModal';
import { TransactionHistory } from '../components/transactions/history/TransactionHistory';
import { EmployeeContract } from '../components/employees/EmployeeContract';
import { CategoryCardType } from '../types';
import { createEmployee, updateEmployee, deleteEmployeeWithHistory, deleteEmployeeOnly } from '../services/employeeService';
import { showErrorNotification } from '../utils/notifications';
import { useCompanyId } from '../contexts/CompanyContext';
import { useEmployees } from '../hooks/useEmployees';
import { useEmployeeFilters } from '../hooks/useEmployeeFilters';
import { useEmployeeStats } from '../hooks/useEmployeeStats';
import { EmployeeSearchBar } from '../components/employees/EmployeeSearchBar';
import { EmployeeStatusFilter } from '../components/employees/EmployeeStatusFilter';
import { EmployeeStats } from '../components/employees/EmployeeStats';
import { useEmployeeHistory } from '../hooks/useEmployeeHistory';
import { useIsAdmin } from '../hooks/useIsAdmin';
import { Navigate } from 'react-router-dom';
import { LoadingSpinner } from '../components/LoadingSpinner';

export const Employees: React.FC = () => {
  const companyId = useCompanyId();
  const { user } = useAuth();
  const { canAccessEmployees, loading: adminCheckLoading } = useIsAdmin();
  const { employees, loading } = useEmployees();
  const { 
    searchQuery, 
    setSearchQuery, 
    statusFilter, 
    setStatusFilter, 
    filteredEmployees 
  } = useEmployeeFilters(employees);
  
  const stats = useEmployeeStats(employees);
  
  const { 
    selectedCategory,
    showHistory,
    handleViewHistory,
    handleCloseHistory 
  } = useEmployeeHistory();

  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showContract, setShowContract] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const navigate = useNavigate();
  const { toggle: toggleMobileSidebar } = useMobileSidebar();

  if (adminCheckLoading) {
    return <LoadingSpinner />;
  }

  if (!canAccessEmployees) {
    return <Navigate to="/" replace />;
  }

  if (loading) {
    return <LoadingSpinner />;
  }

  const handleSave = async (formData: EmployeeFormData) => {
    if (!companyId) return;
    try {
      await createEmployee(formData, companyId);
      setShowAddForm(false);
    } catch (error) {
      showErrorNotification(error instanceof Error ? error.message : 'Произошла ошибка при сохранении');
    }
  };

  const handleUpdate = async (formData: EmployeeFormData) => {
    if (!selectedEmployee || !companyId) return;
    try {
      await updateEmployee(selectedEmployee.id, formData, companyId);
      setShowEditForm(false);
      setSelectedEmployee(null);
    } catch (error) {
      showErrorNotification(error instanceof Error ? error.message : 'Произошла ошибка при обновлении');
    }
  };

  const handleDeleteWithHistory = async () => {
    if (!selectedEmployee || !companyId) return;
    try {
      await deleteEmployeeWithHistory(selectedEmployee, companyId);
      setShowDeleteModal(false);
      setSelectedEmployee(null);
    } catch (error) {
      showErrorNotification(error instanceof Error ? error.message : 'Произошла ошибка при удалении');
    }
  };

  const handleDeleteIconOnly = async () => {
    if (!selectedEmployee || !companyId) return;
    try {
      await deleteEmployeeOnly(selectedEmployee, companyId);
      setShowDeleteModal(false);
      setSelectedEmployee(null);
    } catch (error) {
      showErrorNotification(error instanceof Error ? error.message : 'Произошла ошибка при удалении');
    }
  };

  const handleViewContract = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowContract(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
        {/* Header: как на Feed — [бургер][назад] | Сотрудники | [🔍]; sticky на mobile */}
        <div
          className="sticky md:static top-0 z-[100] md:z-auto bg-white min-h-[56px] md:min-h-0"
          style={{ background: '#ffffff', borderBottom: '1px solid #e5e7eb' }}
        >
          <HeaderSearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Поиск сотрудников..."
            onClose={() => {
              setSearchQuery('');
              setShowSearch(false);
            }}
            isOpen={showSearch}
            mobileOnly
          />
          <div
            className="flex items-center min-h-[56px] h-14 px-3 md:px-4 md:py-4 md:h-auto max-w-7xl mx-auto"
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
                    navigate(-1);
                  }
                }}
                className="flex items-center justify-center w-10 h-10 md:w-auto md:h-auto md:min-w-0 p-2 md:mr-2 flex-shrink-0"
                style={{ color: '#374151' }}
                aria-label="Назад"
              >
                <ArrowLeft className="w-6 h-6" style={{ width: 24, height: 24 }} />
              </button>
              <h1
                className="hidden md:block text-xl sm:text-2xl font-bold text-gray-900"
                style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: '20px', fontWeight: 600, color: '#111827' }}
              >
                Сотрудники
              </h1>
            </div>

            <div className="flex-1 flex items-center justify-center min-w-0 md:hidden">
              <h1
                className="text-center truncate"
                style={{ fontFamily: 'Inter, system-ui, sans-serif', fontSize: '18px', fontWeight: 600, color: '#111827' }}
              >
                Сотрудники
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
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col">
            <div className="mb-6">
              <EmployeeStats
                totalEmployees={stats.total}
                activeEmployees={stats.active}
                inactiveEmployees={stats.inactive}
                totalSalary={stats.totalSalary}
              />

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 px-2 sm:px-0 mt-2 sm:mt-0">
                <div className="hidden md:block flex-1 min-w-0">
                  <EmployeeSearchBar value={searchQuery} onChange={setSearchQuery} />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <EmployeeStatusFilter
                    value={statusFilter}
                    onChange={setStatusFilter}
                  />
                  {companyId && user?.uid && (
                    <button
                      onClick={() => setShowInviteModal(true)}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center whitespace-nowrap"
                    >
                      <UserPlus className="w-5 h-5 mr-1" />
                      <span className="hidden sm:inline">Пригласить пользователя</span>
                      <span className="sm:hidden">Пригласить</span>
                    </button>
                  )}
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors flex items-center whitespace-nowrap"
                  >
                    <Plus className="w-5 h-5 mr-1" />
                    <span className="hidden sm:inline">Добавить сотрудника</span>
                    <span className="sm:hidden">Добавить</span>
                  </button>
                </div>
              </div>
            </div>

            <EmployeeList
                employees={filteredEmployees}
                onEdit={(employee) => {
                  setSelectedEmployee(employee);
                  setShowEditForm(true);
                }}
                onDelete={(employee) => {
                  setSelectedEmployee(employee);
                  setShowDeleteModal(true);
                }}
                onViewHistory={handleViewHistory}
                onViewContract={(employee) => {
                  setSelectedEmployee(employee);
                  setShowContract(true);
                }}
              />
            </div>
          </div>

        <EmployeeForm
          isOpen={showAddForm}
          onClose={() => setShowAddForm(false)}
          onSave={handleSave}
        />

        {companyId && user?.uid && (
          <InviteUserModal
            isOpen={showInviteModal}
            onClose={() => setShowInviteModal(false)}
            companyId={companyId}
            invitedBy={user.uid}
          />
        )}

        {selectedEmployee && (
          <>
            <EmployeeForm
              isOpen={showEditForm}
              onClose={() => {
                setShowEditForm(false);
                setSelectedEmployee(null);
              }}
              onSave={handleUpdate}
              employee={selectedEmployee}
            />

            <DeleteEmployeeModal
              isOpen={showDeleteModal}
              onClose={() => {
                setShowDeleteModal(false);
                setSelectedEmployee(null);
              }}
              onDeleteWithHistory={handleDeleteWithHistory}
              onDeleteIconOnly={handleDeleteIconOnly}
              employeeName={`${selectedEmployee.lastName} ${selectedEmployee.firstName}`}
            />

            <EmployeeContract
              isOpen={showContract}
              onClose={() => {
                setShowContract(false);
                setSelectedEmployee(null);
              }}
              employee={selectedEmployee}
            />
          </>
        )}

        {showHistory && selectedCategory && (
          <TransactionHistory
            category={selectedCategory}
            isOpen={showHistory}
            onClose={handleCloseHistory}
          />
        )}
    </div>
  );
};