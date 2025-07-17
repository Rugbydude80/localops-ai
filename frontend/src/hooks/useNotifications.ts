import { useState } from 'react';

interface NotificationData {
  staffId: number;
  businessId?: number;
  [key: string]: any;
}

export function useNotifications() {
  const [isLoading, setIsLoading] = useState(false);

  const sendNotification = async (type: string, data: NotificationData) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/notifications/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type, ...data }),
      });

      if (!response.ok) {
        throw new Error('Failed to send notification');
      }

      return { success: true };
    } catch (error) {
      console.error('Notification error:', error);
      return { success: false, error };
    } finally {
      setIsLoading(false);
    }
  };

  // Convenience methods
  const notifyShiftAssignment = (staffId: number, shiftData: any) => {
    return sendNotification('shift_assignment', {
      staffId,
      data: shiftData
    });
  };

  const notifyShiftChange = (staffId: number, shiftData: any) => {
    return sendNotification('shift_change', {
      staffId,
      data: shiftData
    });
  };

  const notifyEmergencyShift = (staffIds: number[], shiftData: any) => {
    return Promise.all(
      staffIds.map(staffId => 
        sendNotification('emergency_shift', {
          staffId,
          data: shiftData
        })
      )
    );
  };

  const sendWeeklySchedule = (staffId: number, shifts: any[]) => {
    return sendNotification('weekly_schedule', {
      staffId,
      data: { shifts }
    });
  };

  return {
    isLoading,
    sendNotification,
    notifyShiftAssignment,
    notifyShiftChange,
    notifyEmergencyShift,
    sendWeeklySchedule,
  };
}