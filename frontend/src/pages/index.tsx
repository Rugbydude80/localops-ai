import { useState, useEffect } from 'react'
import Head from 'next/head'
import { PlusIcon, ExclamationTriangleIcon, ClockIcon, CheckCircleIcon, ChartBarIcon } from '@heroicons/react/24/outline'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast, { Toaster } from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { supabase, Staff, EmergencyRequest } from '../../lib/supabase'

// API functions using Supabase
const api = {
  getStaff: async (businessId: number): Promise<Staff[]> => {
    const { data, error } = await supabase
      .from('staff')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('name')
    
    if (error) throw error
    return data || []
  },
  
  createEmergencyRequest: async (requestData: any) => {
    // First, get qualified staff
    const { data: qualifiedStaff, error: staffError } = await supabase
      .from('staff')
      .select('*')
      .eq('business_id', requestData.business_id)
      .eq('is_active', true)
      .contains('skills', [requestData.required_skill])
    
    if (staffError) throw staffError
    
    if (!qualifiedStaff || qualifiedStaff.length === 0) {
      throw new Error(`No staff found with skill: ${requestData.required_skill}`)
    }
    
    // Create the emergency request
    const { data: request, error: requestError } = await supabase
      .from('emergency_requests')
      .insert({
        business_id: requestData.business_id,
        shift_date: requestData.shift_date,
        shift_start: requestData.shift_start,
        shift_end: requestData.shift_end,
        required_skill: requestData.required_skill,
        urgency: requestData.urgency,
        message: requestData.message,
        status: 'pending'
      })
      .select()
      .single()
    
    if (requestError) throw requestError
    
    // Generate AI-powered message
    let aiMessage = `Hi! ${requestData.business_name} needs ${requestData.required_skill} coverage for ${format(new Date(requestData.shift_date), 'EEEE, MMMM d')} ${requestData.shift_start}-${requestData.shift_end}. Can you help?`
    
    try {
      const aiResponse = await fetch('/api/ai/generate-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: requestData.business_name,
          shift_date: requestData.shift_date,
          shift_start: requestData.shift_start,
          shift_end: requestData.shift_end,
          required_skill: requestData.required_skill,
          urgency: requestData.urgency,
          custom_message: requestData.message
        })
      })
      
      if (aiResponse.ok) {
        const aiData = await aiResponse.json()
        aiMessage = aiData.message
      }
    } catch (error) {
      console.log('AI message generation failed, using fallback')
    }
    
    // Simulate sending messages (in production, this would call WhatsApp API)
    const messageResults = qualifiedStaff.map(staff => {
      const fullMessage = `Hi ${staff.name},\n\n${aiMessage}\n\nReply:\n✅ YES to accept\n❌ NO to decline\n⏰ MAYBE if you need more info`
      
      // Log simulated message
      console.log(`SIMULATED WhatsApp to ${staff.phone_number} (${staff.name}):`)
      console.log(fullMessage)
      
      return {
        staff_id: staff.id,
        staff_name: staff.name,
        phone: staff.phone_number,
        sent: true,
        message_id: `sim_${request.id}_${staff.id}`
      }
    })
    
    // Log messages to database
    const messageLogs = qualifiedStaff.map(staff => ({
      business_id: requestData.business_id,
      staff_id: staff.id,
      request_id: request.id,
      message_type: 'emergency_request',
      platform: 'whatsapp',
      phone_number: staff.phone_number,
      message_content: `Hi ${staff.name}, ${requestData.business_name} needs ${requestData.required_skill} coverage for ${format(new Date(requestData.shift_date), 'EEEE, MMMM d')} ${requestData.shift_start}-${requestData.shift_end}. ${requestData.message || ''} Reply YES/NO.`,
      external_message_id: `sim_${request.id}_${staff.id}`,
      status: 'sent'
    }))
    
    await supabase.from('message_logs').insert(messageLogs)
    
    return {
      request,
      qualified_staff_count: qualifiedStaff.length,
      messages_sent: messageResults.length,
      message_results: messageResults
    }
  },
  
  getEmergencyRequests: async (businessId: number): Promise<EmergencyRequest[]> => {
    const { data, error } = await supabase
      .from('emergency_requests')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(50)
    
    if (error) throw error
    return data || []
  },
  
  createStaff: async (staffData: any): Promise<Staff> => {
    const { data, error } = await supabase
      .from('staff')
      .insert({
        business_id: staffData.business_id,
        name: staffData.name,
        phone_number: staffData.phone_number,
        email: staffData.email,
        role: staffData.role,
        skills: staffData.skills,
        reliability_score: 5.0,
        is_active: true
      })
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  updateStaff: async (staffId: number, staffData: any): Promise<Staff> => {
    const { data, error } = await supabase
      .from('staff')
      .update({
        name: staffData.name,
        phone_number: staffData.phone_number,
        email: staffData.email,
        role: staffData.role,
        skills: staffData.skills
      })
      .eq('id', staffId)
      .select()
      .single()
    
    if (error) throw error
    return data
  },

  deleteStaff: async (staffId: number): Promise<void> => {
    const { error } = await supabase
      .from('staff')
      .update({ is_active: false })
      .eq('id', staffId)
    
    if (error) throw error
  }
}

export default function Dashboard() {
  const [businessId] = useState(1) // Demo business ID
  const [showAddStaff, setShowAddStaff] = useState(false)
  const [showEmergencyForm, setShowEmergencyForm] = useState(false)
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null)
  const queryClient = useQueryClient()

  // Queries
  const { data: staff = [], isLoading: staffLoading } = useQuery({
    queryKey: ['staff', businessId],
    queryFn: () => api.getStaff(businessId)
  })

  const { data: emergencyRequests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ['emergency-requests', businessId],
    queryFn: () => api.getEmergencyRequests(businessId)
  })

  // Mutations
  const createEmergencyMutation = useMutation({
    mutationFn: api.createEmergencyRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emergency-requests'] })
      setShowEmergencyForm(false)
      toast.success('Emergency request sent successfully!')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to send emergency request')
    }
  })

  const createStaffMutation = useMutation({
    mutationFn: api.createStaff,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      setShowAddStaff(false)
      toast.success('Staff member added successfully!')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add staff member')
    }
  })

  const updateStaffMutation = useMutation({
    mutationFn: ({ staffId, staffData }: { staffId: number, staffData: any }) => 
      api.updateStaff(staffId, staffData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      setSelectedStaff(null)
      toast.success('Staff member updated successfully!')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update staff member')
    }
  })

  const deleteStaffMutation = useMutation({
    mutationFn: api.deleteStaff,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] })
      setSelectedStaff(null)
      toast.success('Staff member removed successfully!')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to remove staff member')
    }
  })

  return (
    <>
      <Head>
        <title>LocalOps AI - Restaurant Operations</title>
        <meta name="description" content="Smart restaurant operations management" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-slate-50">
        <Toaster position="top-right" toastOptions={{
          duration: 4000,
          style: {
            background: '#fff',
            color: '#374151',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            border: '1px solid rgba(0, 0, 0, 0.05)',
          },
        }} />
        
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-xl">L</span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">LocalOps AI</h1>
                  <p className="text-sm text-gray-500">Restaurant Operations Dashboard</p>
                </div>
              </div>
              <div className="flex space-x-3">
                <a
                  href="/dashboard"
                  className="inline-flex items-center px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 shadow-sm"
                >
                  <ChartBarIcon className="h-4 w-4 mr-2" />
                  Operations Dashboard
                </a>
                <a
                  href="/shifts"
                  className="inline-flex items-center px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 shadow-sm"
                >
                  <ClockIcon className="h-4 w-4 mr-2" />
                  Shifts & Calendar
                </a>
                <button
                  onClick={() => setShowAddStaff(true)}
                  className="inline-flex items-center px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 shadow-sm"
                >
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Add Staff
                </button>
                <button
                  onClick={() => setShowEmergencyForm(true)}
                  className="inline-flex items-center px-4 py-2.5 border border-transparent rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 shadow-sm"
                >
                  <ExclamationTriangleIcon className="h-4 w-4 mr-2" />
                  Emergency Coverage
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Total Staff</p>
                  <p className="text-3xl font-bold text-gray-900">{staff.length}</p>
                </div>
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-xl">{staff.length}</span>
                </div>
              </div>
            </div>
            
            <div className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Filled Requests</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {emergencyRequests.filter(r => r.status === 'filled').length}
                  </p>
                </div>
                <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                  <CheckCircleIcon className="h-7 w-7 text-white" />
                </div>
              </div>
            </div>
            
            <div className="card p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Pending</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {emergencyRequests.filter(r => r.status === 'pending').length}
                  </p>
                </div>
                <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg">
                  <ClockIcon className="h-7 w-7 text-white" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Staff Overview */}
            <div className="lg:col-span-2">
              <div className="card slide-up">
                <div className="px-6 py-5 border-b border-gray-100">
                  <h2 className="text-xl font-semibold text-gray-900">Team Members</h2>
                  <p className="text-sm text-gray-500 mt-1">Manage your restaurant staff</p>
                </div>
                <div className="p-6">
                  {staffLoading ? (
                    <div className="text-center py-12">
                      <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-blue-200 border-t-blue-600"></div>
                      <p className="mt-4 text-gray-600 font-medium">Loading team...</p>
                    </div>
                  ) : staff.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <PlusIcon className="h-8 w-8 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No team members yet</h3>
                      <p className="text-gray-500 mb-6 max-w-sm mx-auto">Get started by adding your first staff member to begin managing your team</p>
                      <button
                        onClick={() => setShowAddStaff(true)}
                        className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 shadow-lg font-medium"
                      >
                        <PlusIcon className="h-5 w-5 mr-2" />
                        Add Staff Member
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {staff.map((member: Staff) => (
                        <div 
                          key={member.id} 
                          className="card p-5 hover:shadow-medium cursor-pointer transition-all duration-200 hover:scale-[1.02]"
                          onClick={() => setSelectedStaff(member)}
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center space-x-3">
                              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                                <span className="text-white font-bold text-sm">
                                  {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <h3 className="font-semibold text-gray-900 text-lg">{member.name}</h3>
                                <p className="text-sm text-gray-500 capitalize">{member.role}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-gray-900">
                                {member.reliability_score.toFixed(1)}
                              </div>
                              <div className="text-xs text-gray-500">Reliability</div>
                            </div>
                          </div>
                          
                          <div className="space-y-3">
                            <p className="text-sm text-gray-600">{member.phone_number}</p>
                            <div className="flex flex-wrap gap-2">
                              {member.skills.map((skill: string) => (
                                <span
                                  key={skill}
                                  className="skill-badge"
                                >
                                  {skill.replace('_', ' ')}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <p className="text-xs text-blue-600 font-medium">Click to edit details</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Recent Emergency Requests */}
            <div>
              <div className="card slide-up">
                <div className="px-6 py-5 border-b border-gray-100">
                  <h2 className="text-xl font-semibold text-gray-900">Recent Requests</h2>
                  <p className="text-sm text-gray-500 mt-1">Emergency coverage requests</p>
                </div>
                <div className="p-6">
                  {requestsLoading ? (
                    <div className="text-center py-12">
                      <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-red-200 border-t-red-600"></div>
                      <p className="mt-4 text-gray-600 font-medium">Loading requests...</p>
                    </div>
                  ) : emergencyRequests.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ExclamationTriangleIcon className="h-8 w-8 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No requests yet</h3>
                      <p className="text-gray-500 text-sm">Emergency requests will appear here</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {emergencyRequests.slice(0, 5).map((request: EmergencyRequest) => (
                        <div key={request.id} className={`p-4 rounded-lg border-l-4 ${
                          request.status === 'filled' 
                            ? 'border-l-green-400 bg-green-50' 
                            : request.status === 'cancelled'
                            ? 'border-l-red-400 bg-red-50'
                            : 'border-l-amber-400 bg-amber-50'
                        }`}>
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900 capitalize">
                                {request.required_skill.replace('_', ' ')} needed
                              </p>
                              <p className="text-sm text-gray-600 mt-1">
                                {format(parseISO(request.shift_date), 'EEEE, MMM d')} • {request.shift_start}-{request.shift_end}
                              </p>
                            </div>
                            <div className="flex items-center ml-3">
                              {request.status === 'filled' ? (
                                <div className="flex items-center space-x-1">
                                  <CheckCircleIcon className="h-5 w-5 text-green-600" />
                                  <span className="text-xs font-medium text-green-700">Filled</span>
                                </div>
                              ) : (
                                <div className="flex items-center space-x-1">
                                  <ClockIcon className="h-5 w-5 text-amber-600" />
                                  <span className="text-xs font-medium text-amber-700">Pending</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-gray-500">
                            {format(parseISO(request.created_at), 'MMM d, h:mm a')}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Emergency Request Modal */}
        {showEmergencyForm && (
          <EmergencyRequestModal
            onClose={() => setShowEmergencyForm(false)}
            onSubmit={(data) => createEmergencyMutation.mutate(data)}
            isLoading={createEmergencyMutation.isPending}
            businessId={businessId}
          />
        )}

        {/* Add Staff Modal */}
        {showAddStaff && (
          <AddStaffModal
            onClose={() => setShowAddStaff(false)}
            onSubmit={(data) => createStaffMutation.mutate(data)}
            isLoading={createStaffMutation.isPending}
            businessId={businessId}
          />
        )}

        {/* Edit Staff Modal */}
        {selectedStaff && (
          <EditStaffModal
            staff={selectedStaff}
            onClose={() => setSelectedStaff(null)}
            onUpdate={(data) => updateStaffMutation.mutate({ staffId: selectedStaff.id, staffData: data })}
            onDelete={() => deleteStaffMutation.mutate(selectedStaff.id)}
            isLoading={updateStaffMutation.isPending || deleteStaffMutation.isPending}
          />
        )}
      </div>
    </>
  )
}

// Emergency Request Modal Component
function EmergencyRequestModal({ onClose, onSubmit, isLoading, businessId }: any) {
  const [formData, setFormData] = useState({
    shift_date: '',
    shift_start: '',
    shift_end: '',
    required_skill: '',
    urgency: 'normal',
    message: '',
    business_name: 'Demo Restaurant'
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      ...formData,
      business_id: businessId,
      shift_date: new Date(formData.shift_date).toISOString()
    })
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
            <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Emergency Coverage Request</h3>
            <p className="text-sm text-gray-500">Send urgent staffing request to qualified team members</p>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              required
              value={formData.shift_date}
              onChange={(e) => setFormData({...formData, shift_date: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
              <input
                type="time"
                required
                value={formData.shift_start}
                onChange={(e) => setFormData({...formData, shift_start: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
              <input
                type="time"
                required
                value={formData.shift_end}
                onChange={(e) => setFormData({...formData, shift_end: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Required Skill</label>
            <select
              required
              value={formData.required_skill}
              onChange={(e) => setFormData({...formData, required_skill: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
            >
              <option value="">Select skill...</option>
              <option value="kitchen">Kitchen</option>
              <option value="bar">Bar</option>
              <option value="front_of_house">Front of House</option>
              <option value="management">Management</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Urgency</label>
            <select
              value={formData.urgency}
              onChange={(e) => setFormData({...formData, urgency: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Additional Message</label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData({...formData, message: e.target.value})}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
              placeholder="Any additional details..."
            />
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-100 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 shadow-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg text-sm font-medium hover:from-red-700 hover:to-red-800 disabled:opacity-50 shadow-sm"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                  Sending...
                </div>
              ) : (
                'Send Request'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Add Staff Modal Component
function AddStaffModal({ onClose, onSubmit, isLoading, businessId }: any) {
  const [formData, setFormData] = useState({
    name: '',
    phone_number: '',
    email: '',
    role: '',
    skills: [] as string[]
  })

  const availableSkills = ['kitchen', 'bar', 'front_of_house', 'management', 'cleaning']

  const handleSkillToggle = (skill: string) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill]
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      ...formData,
      business_id: businessId
    })
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <PlusIcon className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-gray-900">Add Staff Member</h3>
            <p className="text-sm text-gray-500">Add a new team member to your restaurant</p>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input
              type="tel"
              required
              value={formData.phone_number}
              onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
              placeholder="+44 7XXX XXXXXX"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email (Optional)</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Primary Role</label>
            <select
              required
              value={formData.role}
              onChange={(e) => setFormData({...formData, role: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select role...</option>
              <option value="chef">Chef</option>
              <option value="cook">Cook</option>
              <option value="server">Server</option>
              <option value="bartender">Bartender</option>
              <option value="manager">Manager</option>
              <option value="host">Host</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Skills</label>
            <div className="space-y-2">
              {availableSkills.map(skill => (
                <label key={skill} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.skills.includes(skill)}
                    onChange={() => handleSkillToggle(skill)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 capitalize">
                    {skill.replace('_', ' ')}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-100 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 shadow-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg text-sm font-medium hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 shadow-sm"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                  Adding...
                </div>
              ) : (
                'Add Staff'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Edit Staff Modal Component
function EditStaffModal({ staff, onClose, onUpdate, onDelete, isLoading }: any) {
  const [formData, setFormData] = useState({
    name: staff.name,
    phone_number: staff.phone_number,
    email: staff.email || '',
    role: staff.role,
    skills: staff.skills || []
  })

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const availableSkills = ['kitchen', 'bar', 'front_of_house', 'management', 'cleaning']

  const handleSkillToggle = (skill: string) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill]
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onUpdate(formData)
  }

  const handleDelete = () => {
    onDelete()
    setShowDeleteConfirm(false)
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <span className="text-blue-600 font-bold text-sm">
                {staff.name.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
              </span>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900">Edit Staff Member</h3>
              <p className="text-sm text-gray-500">Update {staff.name}'s details</p>
            </div>
          </div>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded-md border border-red-200"
          >
            Remove
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input
              type="tel"
              required
              value={formData.phone_number}
              onChange={(e) => setFormData({...formData, phone_number: e.target.value})}
              placeholder="+44 7XXX XXXXXX"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email (Optional)</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Primary Role</label>
            <select
              required
              value={formData.role}
              onChange={(e) => setFormData({...formData, role: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select role...</option>
              <option value="chef">Chef</option>
              <option value="cook">Cook</option>
              <option value="server">Server</option>
              <option value="bartender">Bartender</option>
              <option value="manager">Manager</option>
              <option value="host">Host</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Skills</label>
            <div className="space-y-2">
              {availableSkills.map(skill => (
                <label key={skill} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.skills.includes(skill)}
                    onChange={() => handleSkillToggle(skill)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 capitalize">
                    {skill.replace('_', ' ')}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-between pt-6 border-t border-gray-100 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 shadow-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg text-sm font-medium hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 shadow-sm"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                  Updating...
                </div>
              ) : (
                'Update Staff'
              )}
            </button>
          </div>
        </form>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-900">Remove Staff Member</h4>
                  <p className="text-sm text-gray-500">This action cannot be undone</p>
                </div>
              </div>
              
              <p className="text-gray-600 mb-6">
                Are you sure you want to remove <strong>{staff.name}</strong> from your team? 
                They will no longer receive shift notifications or be available for scheduling.
              </p>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {isLoading ? 'Removing...' : 'Remove Staff'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}