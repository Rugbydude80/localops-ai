import { NextApiRequest, NextApiResponse } from 'next';
import { emailService } from '../../../lib/emailService';
import { supabase } from '../../../../lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, staffId, data } = req.body;

    // Get staff email
    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .select('email, name')
      .eq('id', staffId)
      .single();

    if (staffError || !staff?.email) {
      return res.status(400).json({ error: 'Staff email not found' });
    }

    let success = false;

    switch (type) {
      case 'shift_assignment':
        success = await emailService.sendShiftAssignment(staff.email, {
          staffName: staff.name,
          ...data
        });
        break;

      case 'shift_change':
        success = await emailService.sendShiftChange(staff.email, {
          staffName: staff.name,
          ...data
        });
        break;

      case 'emergency_shift':
        success = await emailService.sendEmergencyShiftRequest(staff.email, data);
        break;

      case 'weekly_schedule':
        success = await emailService.sendWeeklySchedule(staff.email, staff.name, data.shifts);
        break;

      default:
        return res.status(400).json({ error: 'Invalid notification type' });
    }

    if (success) {
      // Log the notification
      await supabase.from('message_logs').insert({
        business_id: data.businessId || 1,
        staff_id: staffId,
        message_type: type,
        platform: 'email',
        phone_number: staff.email,
        message_content: `Email notification: ${type}`,
        status: 'sent'
      });

      res.status(200).json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to send email' });
    }
  } catch (error) {
    console.error('Email notification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}