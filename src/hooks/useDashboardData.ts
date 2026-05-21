'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_ADMINS, mapDeliveryLogRecord, mapStaffRecord, parseAdminsSetting } from '@/lib/payroll/utils';
import type { AdminRecord, DeliveryLogRecord, StaffRecord } from '@/types/payroll';

export function useDashboardData(onUnauthorized: () => void) {
  const [admins, setAdmins] = useState<AdminRecord[]>(DEFAULT_ADMINS);
  const [staffList, setStaffList] = useState<StaffRecord[]>([]);
  const [deliveryLogs, setDeliveryLogs] = useState<DeliveryLogRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      setIsLoading(true);

      try {
        const response = await fetch('/api/dashboard/bootstrap', { cache: 'no-store' });

        if (response.status === 401 || response.status === 403) {
          onUnauthorized();
          return;
        }

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || 'Unable to load dashboard.');
        }

        if (!isMounted) {
          return;
        }

        setStaffList(Array.isArray(data.staff) ? data.staff.map(mapStaffRecord) : []);
        setDeliveryLogs(Array.isArray(data.deliveryLogs) ? data.deliveryLogs.map(mapDeliveryLogRecord) : []);
        setAdmins(parseAdminsSetting(data.settings));
      } catch (error) {
        console.error('Dashboard bootstrap error:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void fetchData();

    return () => {
      isMounted = false;
    };
  }, [onUnauthorized]);

  return {
    admins,
    setAdmins,
    staffList,
    setStaffList,
    deliveryLogs,
    setDeliveryLogs,
    isLoading,
  };
}

