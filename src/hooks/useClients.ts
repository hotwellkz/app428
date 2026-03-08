import { useState, useEffect } from 'react';
import { Client } from '../types/client';
import { clientService } from '../services/clientService';
import { useCompanyId } from '../contexts/CompanyContext';

export const useClients = () => {
  const companyId = useCompanyId();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setClients([]);
      setLoading(false);
      setError(null);
      return;
    }

    const fetchClients = async () => {
      try {
        const data = await clientService.getAllClients(companyId);
        setClients(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Произошла ошибка при загрузке клиентов');
      } finally {
        setLoading(false);
      }
    };

    fetchClients();
  }, [companyId]);

  return { clients, loading, error };
}; 