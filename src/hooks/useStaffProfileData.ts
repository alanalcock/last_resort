'use client';

import { useEffect, useState } from 'react';
import { mapDeliveryLogRecord, mapStaffRecord } from '@/lib/payroll/utils';
import type { DeliveryLogRecord, StaffRecord } from '@/types/payroll';

export function useStaffProfileData(staffId: number, onUnauthorized: () => void) {
  const [staff, setStaff] = useState<StaffRecord | null>(null);
  const [deliveryLogs, setDeliveryLogs] = useState<DeliveryLogRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (!Number.isFinite(staffId)) {
        setError('Invalid staff profile.');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/staff/${staffId}/profile`, { cache: 'no-store' });

        if (response.status === 401 || response.status === 403) {
          onUnauthorized();
          return;
        }

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || 'Could not load this staff profile.');
        }

        if (!isMounted) {
          return;
        }

        setStaff(data.staff ? mapStaffRecord(data.staff) : null);
        setDeliveryLogs(Array.isArray(data.deliveryLogs) ? data.deliveryLogs.map(mapDeliveryLogRecord) : []);
      } catch (fetchError) {
        console.error('Staff profile load error:', fetchError);
        if (isMounted) {
          setError('Could not load this staff profile.');
        }
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
  }, [onUnauthorized, staffId]);

  return {
    staff,
    setStaff,
    deliveryLogs,
    setDeliveryLogs,
    isLoading,
    error,
    setError,
  };
}

