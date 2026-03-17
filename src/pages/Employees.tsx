import React, { useState } from 'react';
import { ArrowLeft, Plus, Menu, Search, UserPlus, Shield, Trash2, Eraser } from 'lucide-react';
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
import { useCompanyUsers } from '../hooks/useCompanyUsers';
import { Navigate } from 'react-router-dom';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { MenuAccessModal } from '../components/employees/MenuAccessModal';
import { deleteCompanyUser, updateCompanyUserRole } from '../lib/firebase/companies';
import { showSuccessNotification } from '../utils/notifications';
import type { CompanyUserRole } from '../types/company';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Владелец',
  admin: 'Администратор',
  manager: 'Менеджер',
  member: 'Сотрудник'
};

const ALL_ROLES: CompanyUserRole[] = ['owner', 'admin', 'manager', 'member'];

export const Employees: React.FC = () => {
  const companyId = useCompanyId();
  const { user } = useAuth();
  const { canAccessEmployees, canManageUsers, canChangeUserRoles, loading: adminCheckLoading } = useIsAdmin();
  const { employees, loading } = useEmployees();
  const { users: companyUsers, orphans: companyUserOrphans, loading: companyUsersLoading, refetch: refetchCompanyUsers } = useCompanyUsers();
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
  const [menuAccessUser, setMenuAccessUser] = useState<{ userId: string; userName: string } | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [clearingOrphanId, setClearingOrphanId] = useState<string | null>(null);
  const [roleChangeUserId, setRoleChangeUserId] = useState<string | null>(null);

  const handleRoleChange = async (
    cu: { userId: string; role: CompanyUserRole; displayName?: string | null },
    newRole: CompanyUserRole
  ) => {
    if (!companyId || newRole === cu.role) return;
    const ownersCount = companyUsers.filter((c) => c.role === 'owner').length;
    if (cu.role === 'owner' && ownersCount <= 1 && newRole !== 'owner') {
      showErrorNotification('Нельзя понизить последнего владельца компании');
      return;
    }
    const sensitive =
      newRole === 'owner' || newRole === 'admin' || cu.role === 'owner';
    if (sensitive && !window.confirm(
      `Назначить роль «${ROLE_LABELS[newRole]}» пользователю ${cu.displayName ?? cu.userId}?`
    )) {
      return;
    }
    setRoleChangeUserId(cu.userId);
    try {
      await updateCompanyUserRole(cu.userId, newRole, companyId);
      await refetchCompanyUsers();
      showSuccessNotification('Роль пользователя изменена');
    } catch (e) {
      showErrorNotification(e instanceof Error ? e.message : 'Не удалось изменить роль');
    } finally {
      setRoleChangeUserId(null);
    }
  };

  const handleRemoveFromCompany = async (targetUserId: string, displayName: string) => {
    if (!window.confirm(`Удалить пользователя «${displayName}» из компании? Он потеряет доступ к системе.`)) return;
    setRemovingUserId(targetUserId);
    try {
      await deleteCompanyUser(targetUserId);
      await refetchCompanyUsers();
      showSuccessNotification('Пользователь удалён из компании');
    } catch (e) {
      showErrorNotification(e instanceof Error ? e.message : 'Не удалось удалить');
    } finally {
      setRemovingUserId(null);
    }
  };

  const handleClearOrphan = async (targetUserId: string) => {
    if (!window.confirm('Удалить эту осиротевшую запись из базы? Документ company_users будет удалён.')) return;
    setClearingOrphanId(targetUserId);
    try {
      await deleteCompanyUser(targetUserId);
      showSuccessNotification('Осиротевшая запись удалена');
    } catch (e) {
      showErrorNotification(e instanceof Error ? e.message : 'Не удалось очистить');
    } finally {
      setClearingOrphanId(null);
    }
  };

  const handleClearAllOrphans = async () => {
    if (companyUserOrphans.length === 0) return;
    if (!window.confirm(`Удалить все ${companyUserOrphans.length} осиротевших записей?`)) return;
    let ok = 0;
    let err = 0;
    for (const o of companyUserOrphans) {
      try {
        await deleteCompanyUser(o.userId);
        ok += 1;
      } catch {
        err += 1;
      }
    }
    if (ok) showSuccessNotification(`Удалено записей: ${ok}`);
    if (err) showErrorNotification(`Не удалось удалить: ${err}`);
  };

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
            {canManageUsers && (
              <div className="mb-6 bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200">
                  <h2 className="text-base font-semibold text-gray-900">Пользователи с доступом к системе</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Управление правами доступа к разделам меню</p>
                </div>
                {companyUsersLoading ? (
                  <div className="p-4 flex justify-center">
                    <LoadingSpinner />
                  </div>
                ) : companyUsers.length === 0 && companyUserOrphans.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500">Нет пользователей. Пригласите пользователя по кнопке выше.</div>
                ) : (
                  <>
                    {companyUsers.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email / Имя</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Роль</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Действия</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {companyUsers.map((cu) => {
                              const isSelf = cu.userId === user?.uid;
                              const display = cu.displayName || cu.email || cu.userId;
                              const ownersCount = companyUsers.filter((c) => c.role === 'owner').length;
                              const isLastOwner = cu.role === 'owner' && ownersCount <= 1;
                              const canEditRole = canChangeUserRoles && !isSelf && companyId;
                              return (
                                <tr key={cu.userId} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 text-sm text-gray-900">{display}</td>
                                  <td className="px-4 py-3 text-sm text-gray-600">
                                    {canEditRole ? (
                                      <select
                                        value={cu.role}
                                        onChange={(e) => handleRoleChange(cu, e.target.value as CompanyUserRole)}
                                        disabled={roleChangeUserId === cu.userId}
                                        className="text-sm border border-gray-300 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:opacity-50"
                                        title="Изменить роль"
                                      >
                                        {ALL_ROLES.map((r) => (
                                          <option
                                            key={r}
                                            value={r}
                                            disabled={isLastOwner && r !== 'owner'}
                                          >
                                            {ROLE_LABELS[r] ?? r}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <span>{ROLE_LABELS[cu.role] ?? cu.role}</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                  <div className="flex justify-end gap-1">
                                    <button
                                      type="button"
                                      onClick={() => !isSelf && setMenuAccessUser({ userId: cu.userId, userName: display })}
                                      disabled={isSelf}
                                      title={isSelf ? 'Нельзя изменить права себе' : 'Права доступа к разделам'}
                                      className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                      <Shield className="w-5 h-5" />
                                    </button>
                                    {!isSelf && (
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveFromCompany(cu.userId, display)}
                                        disabled={removingUserId === cu.userId}
                                        title="Удалить из компании"
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                                      >
                                        {removingUserId === cu.userId ? (
                                          <span className="inline-block w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                          <Trash2 className="w-5 h-5" />
                                        )}
                                      </button>
                                    )}
                                  </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {companyUserOrphans.length > 0 && (
                      <div className="border-t border-gray-200 px-4 py-3 bg-amber-50/50">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="text-sm text-amber-800">
                            Осиротевшие записи (пользователь удалён, в Firestore осталась только привязка): {companyUserOrphans.length}
                          </p>
                          <button
                            type="button"
                            onClick={handleClearAllOrphans}
                            className="text-sm font-medium text-amber-700 hover:text-amber-900 flex items-center gap-1"
                          >
                            <Eraser className="w-4 h-4" />
                            Очистить все
                          </button>
                        </div>
                        <div className="overflow-x-auto mt-2">
                          <table className="min-w-full divide-y divide-amber-200">
                            <thead className="bg-amber-100/50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-amber-800 uppercase">Email / ID</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-amber-800 uppercase">Роль</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-amber-800 uppercase">Действия</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-amber-100">
                              {companyUserOrphans.map((o) => {
                                const display = o.email || o.userId;
                                return (
                                  <tr key={o.userId} className="hover:bg-amber-50/50">
                                    <td className="px-4 py-2 text-sm text-amber-900">{display}</td>
                                    <td className="px-4 py-2 text-sm text-amber-700">{ROLE_LABELS[o.role] ?? o.role}</td>
                                    <td className="px-4 py-2 text-right">
                                      <button
                                        type="button"
                                        onClick={() => handleClearOrphan(o.userId)}
                                        disabled={clearingOrphanId === o.userId}
                                        title="Удалить осиротевшую запись из базы"
                                        className="p-2 text-amber-700 hover:bg-amber-100 rounded-lg disabled:opacity-50 flex items-center gap-1"
                                      >
                                        {clearingOrphanId === o.userId ? (
                                          <span className="inline-block w-4 h-4 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                          <Eraser className="w-4 h-4" />
                                        )}
                                        Очистить
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

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

        {menuAccessUser && (
          <MenuAccessModal
            isOpen={!!menuAccessUser}
            onClose={() => setMenuAccessUser(null)}
            userId={menuAccessUser.userId}
            userName={menuAccessUser.userName}
            onSaved={() => setMenuAccessUser(null)}
          />
        )}
    </div>
  );
};