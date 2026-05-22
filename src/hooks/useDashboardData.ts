'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_ADMINS, mapAdminRecord, mapDeliveryLogRecord, mapStaffRecord } from '@/lib/payroll/utils';
import type { AdminRecord, DeliveryLogRecord, StaffRecord } from '@/types/payroll';

export function useDashboardData(onUnauthorized: () => void) {
  const [admins, setAdmins] = useState<AdminRecord[]>(DEFAULT_ADMINS);
  const [staffList, setStaffList] = useState<StaffRecord[]>([]);
  const [deliveryLogs, setDeliveryLogs] = useState<DeliveryLogRecord[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<any[]>([]);
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

        const getLocalDateString = () => {
          const d = new Date();
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };
        const todayStr = getLocalDateString();

        const [staffResponse, adminsResponse, deliveryLogsResponse, attendanceResponse] = await Promise.all([
          fetch('/api/staff', { cache: 'no-store' }),
          fetch('/api/admins', { cache: 'no-store' }),
          fetch('/api/delivery-logs', { cache: 'no-store' }),
          fetch(`/api/attendance?date=${todayStr}`, { cache: 'no-store' }),
        ]);

        const [staffData, adminsData, deliveryLogsData, attendanceData] = await Promise.all([
          staffResponse.json(),
          adminsResponse.json(),
          deliveryLogsResponse.json(),
          attendanceResponse.json(),
        ]);

        if (!staffResponse.ok) {
          throw new Error(staffData?.error || 'Unable to load staff.');
        }
        if (!adminsResponse.ok) {
          throw new Error(adminsData?.error || 'Unable to load administrators.');
        }
        if (!deliveryLogsResponse.ok) {
          throw new Error(deliveryLogsData?.error || 'Unable to load delivery logs.');
        }
        if (!attendanceResponse.ok) {
          throw new Error(attendanceData?.error || 'Unable to load today\'s attendance.');
        }

        if (!isMounted) {
          return;
        }

        setStaffList(Array.isArray(staffData) ? staffData.map(mapStaffRecord) : []);
        setDeliveryLogs(Array.isArray(deliveryLogsData) ? deliveryLogsData.map(mapDeliveryLogRecord) : []);
        setAdmins(Array.isArray(adminsData) ? adminsData.map(mapAdminRecord) : DEFAULT_ADMINS);
        setTodayAttendance(Array.isArray(attendanceData) ? attendanceData : []);
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

  const fetchAttendance = async (dateStr: string) => {
    try {
      const res = await fetch(`/api/attendance?date=${dateStr}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setTodayAttendance(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error('Failed to fetch attendance for date:', e);
    }
  };

  return {
    admins,
    setAdmins,
    staffList,
    setStaffList,
    deliveryLogs,
    setDeliveryLogs,
    todayAttendance,
    setTodayAttendance,
    fetchAttendance,
    isLoading,
  };
}
