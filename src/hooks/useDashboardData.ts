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
        const meResponse = await fetch('/api/portal/me', { cache: 'no-store' });
        if (meResponse.status === 401 || meResponse.status === 403) {
          onUnauthorized();
          return;
        }

        const meData = await meResponse.json();
        if (!meResponse.ok || meData?.user?.isAdmin !== true) {
          onUnauthorized();
          return;
        }

        const [staffResponse, settingsResponse, deliveryLogsResponse] = await Promise.all([
          fetch('/api/staff', { cache: 'no-store' }),
          fetch('/api/settings', { cache: 'no-store' }),
          fetch('/api/delivery-logs', { cache: 'no-store' }),
        ]);

        const [staffData, settingsData, deliveryLogsData] = await Promise.all([
          staffResponse.json(),
          settingsResponse.json(),
          deliveryLogsResponse.json(),
        ]);

        if (!staffResponse.ok) {
          throw new Error(staffData?.error || 'Unable to load staff.');
        }
        if (!settingsResponse.ok) {
          throw new Error(settingsData?.error || 'Unable to load settings.');
        }
        if (!deliveryLogsResponse.ok) {
          throw new Error(deliveryLogsData?.error || 'Unable to load delivery logs.');
        }

        if (!isMounted) {
          return;
        }

        setStaffList(Array.isArray(staffData) ? staffData.map(mapStaffRecord) : []);
        setDeliveryLogs(Array.isArray(deliveryLogsData) ? deliveryLogsData.map(mapDeliveryLogRecord) : []);
        setAdmins(parseAdminsSetting(settingsData));
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
