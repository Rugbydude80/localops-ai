// Email service for workforce management notifications
// Using Resend (modern, developer-friendly) - you can swap for SendGrid/others

interface EmailTemplate {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface ShiftNotificationData {
  staffName: string;
  shiftTitle: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  location?: string;
  notes?: string;
}

interface EmergencyShiftData {
  shiftTitle: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  urgency: string;
  hourlyRate?: number;
  requiredSkill: string;
}

class EmailService {
  private apiKey: string;
  private fromEmail: string;

  constructor() {
    this.apiKey = process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY || '';
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@yourcompany.com';
  }

  // Send shift assignment notification
  async sendShiftAssignment(email: string, data: ShiftNotificationData): Promise<boolean> {
    const template = this.generateShiftAssignmentTemplate(data);
    
    return this.sendEmail({
      to: email,
      subject: `Shift Assigned: ${data.shiftTitle} - ${data.shiftDate}`,
      html: template.html,
      text: template.text
    });
  }

  // Send shift change notification
  async sendShiftChange(email: string, data: ShiftNotificationData): Promise<boolean> {
    const template = this.generateShiftChangeTemplate(data);
    
    return this.sendEmail({
      to: email,
      subject: `Shift Updated: ${data.shiftTitle} - ${data.shiftDate}`,
      html: template.html,
      text: template.text
    });
  }

  // Send emergency shift request
  async sendEmergencyShiftRequest(email: string, data: EmergencyShiftData): Promise<boolean> {
    const template = this.generateEmergencyShiftTemplate(data);
    
    return this.sendEmail({
      to: email,
      subject: `🚨 Emergency Shift Available - ${data.shiftDate}`,
      html: template.html,
      text: template.text
    });
  }

  // Send weekly schedule summary
  async sendWeeklySchedule(email: string, staffName: string, shifts: any[]): Promise<boolean> {
    const template = this.generateWeeklyScheduleTemplate(staffName, shifts);
    
    return this.sendEmail({
      to: email,
      subject: `Your Weekly Schedule - Week of ${new Date().toLocaleDateString()}`,
      html: template.html,
      text: template.text
    });
  }

  // Core email sending function
  private async sendEmail(emailData: EmailTemplate): Promise<boolean> {
    try {
      // Using Resend API (replace with your preferred service)
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to: emailData.to,
          subject: emailData.subject,
          html: emailData.html,
          text: emailData.text,
        }),
      });

      if (!response.ok) {
        console.error('Email send failed:', await response.text());
        return false;
      }

      console.log('Email sent successfully to:', emailData.to);
      return true;
    } catch (error) {
      console.error('Email service error:', error);
      return false;
    }
  }

  // Template generators
  private generateShiftAssignmentTemplate(data: ShiftNotificationData) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">New Shift Assignment</h2>
        <p>Hi ${data.staffName},</p>
        <p>You've been assigned to a new shift:</p>
        
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #374151;">${data.shiftTitle}</h3>
          <p><strong>Date:</strong> ${data.shiftDate}</p>
          <p><strong>Time:</strong> ${data.startTime} - ${data.endTime}</p>
          ${data.location ? `<p><strong>Location:</strong> ${data.location}</p>` : ''}
          ${data.notes ? `<p><strong>Notes:</strong> ${data.notes}</p>` : ''}
        </div>
        
        <p>Please confirm your availability or contact your manager if you have any conflicts.</p>
        <p>Thanks,<br>Your Scheduling Team</p>
      </div>
    `;

    const text = `
      New Shift Assignment
      
      Hi ${data.staffName},
      
      You've been assigned to: ${data.shiftTitle}
      Date: ${data.shiftDate}
      Time: ${data.startTime} - ${data.endTime}
      ${data.location ? `Location: ${data.location}` : ''}
      ${data.notes ? `Notes: ${data.notes}` : ''}
      
      Please confirm your availability or contact your manager if you have any conflicts.
    `;

    return { html, text };
  }

  private generateShiftChangeTemplate(data: ShiftNotificationData) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Shift Update</h2>
        <p>Hi ${data.staffName},</p>
        <p>Your shift has been updated:</p>
        
        <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #374151;">${data.shiftTitle}</h3>
          <p><strong>Date:</strong> ${data.shiftDate}</p>
          <p><strong>Time:</strong> ${data.startTime} - ${data.endTime}</p>
          ${data.location ? `<p><strong>Location:</strong> ${data.location}</p>` : ''}
          ${data.notes ? `<p><strong>Notes:</strong> ${data.notes}</p>` : ''}
        </div>
        
        <p>Please review the changes and contact your manager if you have any questions.</p>
        <p>Thanks,<br>Your Scheduling Team</p>
      </div>
    `;

    const text = `
      Shift Update
      
      Hi ${data.staffName},
      
      Your shift has been updated: ${data.shiftTitle}
      Date: ${data.shiftDate}
      Time: ${data.startTime} - ${data.endTime}
      ${data.location ? `Location: ${data.location}` : ''}
      ${data.notes ? `Notes: ${data.notes}` : ''}
      
      Please review the changes and contact your manager if you have any questions.
    `;

    return { html, text };
  }

  private generateEmergencyShiftTemplate(data: EmergencyShiftData) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">🚨 Emergency Shift Available</h2>
        <p>We need immediate coverage for an upcoming shift:</p>
        
        <div style="background: #fef2f2; border: 2px solid #dc2626; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #374151;">${data.shiftTitle}</h3>
          <p><strong>Date:</strong> ${data.shiftDate}</p>
          <p><strong>Time:</strong> ${data.startTime} - ${data.endTime}</p>
          <p><strong>Required Skill:</strong> ${data.requiredSkill}</p>
          <p><strong>Urgency:</strong> ${data.urgency.toUpperCase()}</p>
          ${data.hourlyRate ? `<p><strong>Rate:</strong> £${data.hourlyRate}/hour</p>` : ''}
        </div>
        
        <p><strong>Can you cover this shift?</strong> Please respond ASAP!</p>
        <p>Reply to this email or call the manager directly.</p>
        <p>Thanks,<br>Your Management Team</p>
      </div>
    `;

    const text = `
      🚨 EMERGENCY SHIFT AVAILABLE
      
      We need immediate coverage for: ${data.shiftTitle}
      Date: ${data.shiftDate}
      Time: ${data.startTime} - ${data.endTime}
      Required Skill: ${data.requiredSkill}
      Urgency: ${data.urgency.toUpperCase()}
      ${data.hourlyRate ? `Rate: £${data.hourlyRate}/hour` : ''}
      
      Can you cover this shift? Please respond ASAP!
    `;

    return { html, text };
  }

  private generateWeeklyScheduleTemplate(staffName: string, shifts: any[]) {
    const shiftsHtml = shifts.map(shift => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${shift.date}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${shift.title}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${shift.start_time} - ${shift.end_time}</td>
      </tr>
    `).join('');

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Your Weekly Schedule</h2>
        <p>Hi ${staffName},</p>
        <p>Here's your schedule for the upcoming week:</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Date</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Shift</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #d1d5db;">Time</th>
            </tr>
          </thead>
          <tbody>
            ${shiftsHtml}
          </tbody>
        </table>
        
        <p>Have a great week!</p>
        <p>Your Scheduling Team</p>
      </div>
    `;

    const shiftsText = shifts.map(shift => 
      `${shift.date} - ${shift.title} (${shift.start_time} - ${shift.end_time})`
    ).join('\n');

    const text = `
      Your Weekly Schedule
      
      Hi ${staffName},
      
      Here's your schedule for the upcoming week:
      
      ${shiftsText}
      
      Have a great week!
    `;

    return { html, text };
  }
}

export const emailService = new EmailService();