import React, { useState, useEffect } from 'react';
import { XMarkIcon, PaperAirplaneIcon, UserGroupIcon, ExclamationTriangleIcon, BellIcon } from '@heroicons/react/24/outline';
import { apiClient } from '../lib/api';

interface SmartMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: number;
  senderId: number;
}

interface StaffMember {
  id: number;
  name: string;
  role: string;
  department: string;
  phone_number: string;
  email: string;
  is_active: boolean;
}

interface MessageTemplate {
  id: string;
  name: string;
  content: string;
  type: string;
  variables: string[];
}

const MESSAGE_TYPES = [
  {
    id: 'reminder',
    name: 'Reminder',
    icon: BellIcon,
    description: 'General reminders and announcements',
    color: 'blue'
  },
  {
    id: 'urgent_cover',
    name: 'Urgent Cover Request',
    icon: ExclamationTriangleIcon,
    description: 'Emergency shift coverage needed',
    color: 'red'
  },
  {
    id: 'shift_change',
    name: 'Shift Change',
    icon: UserGroupIcon,
    description: 'Schedule modifications and updates',
    color: 'yellow'
  },
  {
    id: 'training',
    name: 'Training',
    icon: UserGroupIcon,
    description: 'Training announcements and updates',
    color: 'green'
  },
  {
    id: 'announcement',
    name: 'Announcement',
    icon: BellIcon,
    description: 'General business announcements',
    color: 'purple'
  }
];

const RECIPIENT_GROUPS = [
  { id: 'all', name: 'All Staff', description: 'Send to everyone' },
  { id: 'chefs', name: 'Kitchen Staff', description: 'Chefs, cooks, prep staff' },
  { id: 'front_house', name: 'Front of House', description: 'Servers, hosts, bartenders' },
  { id: 'managers', name: 'Management', description: 'Managers and supervisors' },
  { id: 'part_time', name: 'Part-time Staff', description: 'Part-time employees' },
  { id: 'full_time', name: 'Full-time Staff', description: 'Full-time employees' }
];

export default function SmartMessageModal({ isOpen, onClose, businessId, senderId }: SmartMessageModalProps) {
  const [step, setStep] = useState(1);
  const [selectedMessageType, setSelectedMessageType] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [customRecipients, setCustomRecipients] = useState<number[]>([]);
  const [messageContent, setMessageContent] = useState('');
  const [subject, setSubject] = useState('');
  const [priority, setPriority] = useState('normal');
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadStaffMembers();
      loadTemplates();
    }
  }, [isOpen, businessId]);

  const loadStaffMembers = async () => {
    try {
      const response = await apiClient.getStaff(businessId);
      setStaffMembers(response as StaffMember[]);
    } catch (error) {
      console.error('Error loading staff members:', error);
    }
  };

  const loadTemplates = async () => {
    try {
      // For now, we'll use mock templates since the endpoint might not exist yet
      const mockTemplates: MessageTemplate[] = [
        {
          id: 'reminder_1',
          name: 'Shift Reminder',
          content: 'Hi {name}, this is a friendly reminder about your upcoming shift on {date} at {time}.',
          type: 'reminder',
          variables: ['name', 'date', 'time']
        },
        {
          id: 'urgent_1',
          name: 'Urgent Cover Request',
          content: 'URGENT: We need {role} coverage for {date} {time}. Can you help? Please respond ASAP.',
          type: 'urgent_cover',
          variables: ['role', 'date', 'time']
        },
        {
          id: 'training_1',
          name: 'Training Announcement',
          content: 'New training module available: {module_name}. Please complete by {deadline}.',
          type: 'training',
          variables: ['module_name', 'deadline']
        }
      ];
      setTemplates(mockTemplates);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const handleRecipientSelection = (recipientType: string) => {
    if (selectedRecipients.includes(recipientType)) {
      setSelectedRecipients(selectedRecipients.filter(r => r !== recipientType));
    } else {
      setSelectedRecipients([...selectedRecipients, recipientType]);
    }
  };

  const handleCustomRecipientSelection = (staffId: number) => {
    if (customRecipients.includes(staffId)) {
      setCustomRecipients(customRecipients.filter(id => id !== staffId));
    } else {
      setCustomRecipients([...customRecipients, staffId]);
    }
  };

  const getFilteredStaff = () => {
    let filtered = staffMembers.filter(staff => staff.is_active);

    // If 'all' is selected, return all active staff
    if (selectedRecipients.includes('all')) {
      return filtered;
    }

    selectedRecipients.forEach(recipientType => {
      switch (recipientType) {
        case 'chefs':
          filtered = filtered.filter(staff => 
            staff.role.toLowerCase().includes('chef') || 
            staff.role.toLowerCase().includes('cook') ||
            staff.department?.toLowerCase().includes('kitchen')
          );
          break;
        case 'front_house':
          filtered = filtered.filter(staff => 
            staff.role.toLowerCase().includes('server') || 
            staff.role.toLowerCase().includes('host') ||
            staff.role.toLowerCase().includes('bartender') ||
            staff.department?.toLowerCase().includes('front')
          );
          break;
        case 'managers':
          filtered = filtered.filter(staff => 
            staff.role.toLowerCase().includes('manager') || 
            staff.role.toLowerCase().includes('supervisor')
          );
          break;
        case 'part_time':
          // This would need additional data in the staff model
          break;
        case 'full_time':
          // This would need additional data in the staff model
          break;
      }
    });

    return filtered;
  };

  const getFinalRecipients = () => {
    const filteredStaff = getFilteredStaff();
    const customStaff = staffMembers.filter(staff => customRecipients.includes(staff.id));
    
    // Combine and remove duplicates
    const allStaff = [...filteredStaff, ...customStaff];
    return allStaff.filter((staff, index, self) => 
      index === self.findIndex(s => s.id === staff.id)
    );
  };

  const handleTemplateSelection = (template: MessageTemplate) => {
    setSelectedTemplate(template);
    setMessageContent(template.content);
    setSubject(template.name);
  };

  const handleSendMessage = async () => {
    if (!messageContent.trim() || getFinalRecipients().length === 0) {
      alert('Please enter a message and select recipients');
      return;
    }

    setIsSending(true);
    try {
      const messageData = {
        type: selectedMessageType,
        subject: subject,
        content: messageContent,
        priority: priority,
        filters: {
          roles: selectedRecipients,
          custom_staff_ids: customRecipients
        },
        channels: ['whatsapp', 'sms'],
        scheduled_for: null
      };

      const result = await apiClient.sendSmartMessage(businessId, messageData);
      
      const recipientCount = (result as any).target_staff_count || getFinalRecipients().length;
      alert(`✅ Message sent successfully!\n\n📱 Sent to ${recipientCount} staff members\n📧 Channels: WhatsApp & SMS\n⏱️ Delivery: Immediate`);
      onClose();
      resetForm();
    } catch (error) {
      console.error('Error sending message:', error);
      alert('❌ Failed to send message. Please check your connection and try again.');
    } finally {
      setIsSending(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setSelectedMessageType('');
    setSelectedRecipients([]);
    setCustomRecipients([]);
    setMessageContent('');
    setSubject('');
    setPriority('normal');
    setSelectedTemplate(null);
  };

  const handleClose = () => {
    onClose();
    resetForm();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Send Smart Message</h2>
            <p className="text-sm text-gray-500">Step {step} of 3</p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Select Message Type</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {MESSAGE_TYPES.map((type) => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.id}
                        onClick={() => {
                          setSelectedMessageType(type.id);
                          setStep(2);
                        }}
                        className={`p-4 border-2 rounded-lg text-left hover:border-${type.color}-300 hover:bg-${type.color}-50 transition-colors ${
                          selectedMessageType === type.id ? `border-${type.color}-500 bg-${type.color}-50` : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <Icon className={`h-6 w-6 text-${type.color}-600`} />
                          <div>
                            <h4 className="font-medium text-gray-900">{type.name}</h4>
                            <p className="text-sm text-gray-500">{type.description}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Select Recipients</h3>
                
                {/* Recipient Groups */}
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Recipient Groups</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {RECIPIENT_GROUPS.map((group) => (
                      <label key={group.id} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedRecipients.includes(group.id)}
                          onChange={() => handleRecipientSelection(group.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <div>
                          <div className="font-medium text-gray-900">{group.name}</div>
                          <div className="text-sm text-gray-500">{group.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Custom Recipients */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Individual Staff Members</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto">
                    {staffMembers.filter(staff => staff.is_active).map((staff) => (
                      <label key={staff.id} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={customRecipients.includes(staff.id)}
                          onChange={() => handleCustomRecipientSelection(staff.id)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <div>
                          <div className="font-medium text-gray-900">{staff.name}</div>
                          <div className="text-sm text-gray-500">{staff.role}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Selected Recipients Summary */}
                {getFinalRecipients().length > 0 && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>{getFinalRecipients().length}</strong> staff members selected
                    </p>
                    <div className="mt-2 text-xs text-blue-600">
                      {getFinalRecipients().slice(0, 3).map(staff => staff.name).join(', ')}
                      {getFinalRecipients().length > 3 && ` and ${getFinalRecipients().length - 3} more`}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  disabled={getFinalRecipients().length === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Compose Message</h3>
                
                {/* Message Templates */}
                {templates.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Message Templates</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {templates.map((template) => (
                        <button
                          key={template.id}
                          onClick={() => handleTemplateSelection(template)}
                          className={`p-3 border-2 rounded-lg text-left hover:border-blue-300 hover:bg-blue-50 transition-colors ${
                            selectedTemplate?.id === template.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                          }`}
                        >
                          <div className="font-medium text-gray-900">{template.name}</div>
                          <div className="text-sm text-gray-500 mt-1">{template.content.substring(0, 60)}...</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Subject */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subject (Optional)
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Enter message subject..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Priority */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                {/* Message Content */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Message Content
                  </label>
                  <textarea
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                    placeholder="Enter your message..."
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {messageContent.length} characters
                  </p>
                </div>

                {/* Recipients Summary */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Sending to:</h4>
                  <div className="text-sm text-gray-600">
                    <strong>{getFinalRecipients().length}</strong> staff members
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    {getFinalRecipients().slice(0, 5).map(staff => staff.name).join(', ')}
                    {getFinalRecipients().length > 5 && ` and ${getFinalRecipients().length - 5} more`}
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(2)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Back
                </button>
                <button
                  onClick={handleSendMessage}
                  disabled={!messageContent.trim() || isSending}
                  className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSending ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <PaperAirplaneIcon className="h-4 w-4" />
                      <span>Send Message</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 