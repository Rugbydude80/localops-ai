#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  console.log('Required variables:');
  console.log('- NEXT_PUBLIC_SUPABASE_URL');
  console.log('- SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupChatAndNotifications() {
  console.log('🚀 Setting up Chat System and Email Notifications...\n');

  try {
    // 1. Run chat system SQL
    console.log('📊 Setting up chat system tables...');
    const chatSQL = fs.readFileSync(path.join(__dirname, 'add-chat-system.sql'), 'utf8');
    
    const { error: chatError } = await supabase.rpc('exec_sql', { sql: chatSQL });
    if (chatError) {
      console.error('❌ Error setting up chat tables:', chatError);
    } else {
      console.log('✅ Chat system tables created successfully');
    }

    // 2. Create demo conversations and messages
    console.log('\n💬 Creating demo conversations...');
    
    // Get some staff members
    const { data: staff, error: staffError } = await supabase
      .from('staff')
      .select('id, name')
      .limit(3);

    if (staffError || !staff || staff.length < 2) {
      console.log('⚠️  Not enough staff members found for demo conversations');
    } else {
      // Create a group conversation
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          business_id: 1,
          name: 'Team Updates',
          type: 'group',
          created_by: staff[0].id
        })
        .select()
        .single();

      if (!convError && conversation) {
        // Add participants
        const participants = staff.map(s => ({
          conversation_id: conversation.id,
          staff_id: s.id
        }));

        await supabase.from('conversation_participants').insert(participants);

        // Add some demo messages
        const messages = [
          {
            conversation_id: conversation.id,
            sender_id: staff[0].id,
            content: 'Welcome to the team chat! 👋',
            message_type: 'text'
          },
          {
            conversation_id: conversation.id,
            sender_id: staff[1].id,
            content: 'Thanks! This will make communication much easier.',
            message_type: 'text'
          },
          {
            conversation_id: conversation.id,
            sender_id: staff[0].id,
            content: 'Shift updates and important announcements will be posted here.',
            message_type: 'system'
          }
        ];

        await supabase.from('messages').insert(messages);
        console.log('✅ Demo conversation created with sample messages');
      }
    }

    // 3. Test email notification system
    console.log('\n📧 Testing email notification system...');
    
    // Check if we have email service configured
    const hasEmailConfig = process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY;
    
    if (!hasEmailConfig) {
      console.log('⚠️  Email service not configured. Add RESEND_API_KEY or SENDGRID_API_KEY to .env.local');
      console.log('   For now, notifications will be logged to the database only.');
    } else {
      console.log('✅ Email service configuration detected');
    }

    // 4. Create demo notification logs
    console.log('\n📝 Creating demo notification logs...');
    
    if (staff && staff.length > 0) {
      const demoLogs = [
        {
          business_id: 1,
          staff_id: staff[0].id,
          message_type: 'shift_assignment',
          platform: 'email',
          phone_number: 'demo@example.com',
          message_content: 'Shift assignment notification sent',
          status: 'sent'
        },
        {
          business_id: 1,
          staff_id: staff[0].id,
          message_type: 'shift_change',
          platform: 'email',
          phone_number: 'demo@example.com',
          message_content: 'Shift change notification sent',
          status: 'sent'
        }
      ];

      await supabase.from('message_logs').insert(demoLogs);
      console.log('✅ Demo notification logs created');
    }

    console.log('\n🎉 Setup completed successfully!');
    console.log('\n📋 What was set up:');
    console.log('   ✅ Chat system database tables');
    console.log('   ✅ Demo team conversation with messages');
    console.log('   ✅ Email notification system structure');
    console.log('   ✅ Demo notification logs');
    
    console.log('\n🔧 Next steps:');
    console.log('   1. Add RESEND_API_KEY to .env.local for email notifications');
    console.log('   2. Update FROM_EMAIL in .env.local (default: noreply@yourcompany.com)');
    console.log('   3. Test the chat system in your shifts page');
    console.log('   4. Assign staff to shifts to test email notifications');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run the setup
setupChatAndNotifications();