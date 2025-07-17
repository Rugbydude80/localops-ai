import { NextApiRequest, NextApiResponse } from 'next'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const {
    business_name,
    shift_date,
    shift_start,
    shift_end,
    required_skill,
    urgency = 'normal',
    custom_message
  } = req.body

  if (!process.env.OPENAI_API_KEY) {
    // Fallback message when OpenAI is not configured
    const fallbackMessage = `Hi! ${business_name} needs ${required_skill} coverage for ${new Date(shift_date).toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric' })}, ${shift_start}-${shift_end}. Can you help?`
    return res.status(200).json({ message: fallbackMessage, ai_generated: false })
  }

  try {
    const formattedDate = new Date(shift_date).toLocaleDateString('en-GB', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    })

    const urgencyPrefix = {
      'low': 'Hi there!',
      'normal': 'Hi!',
      'high': 'Urgent:',
      'critical': 'URGENT:'
    }[urgency] || 'Hi!'

    const prompt = `Generate a professional but friendly WhatsApp message for a restaurant staff coverage request.

Context:
- Business: ${business_name}
- Date: ${formattedDate}
- Time: ${shift_start} - ${shift_end}
- Role needed: ${required_skill}
- Urgency: ${urgency}
- Custom message: ${custom_message || 'None'}

Requirements:
- Keep it under 160 characters for mobile readability
- Sound urgent but not panicked
- Be specific about time and role
- Include the business name
- Professional but friendly tone
- End with clear call to action

Do not include response instructions (YES/NO) as those will be added separately.`

    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are an expert at writing concise, professional restaurant staff communications. Focus on clarity and urgency while maintaining a friendly tone.'
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 100,
      temperature: 0.7
    })

    let aiMessage = response.choices[0].message.content?.strip() || ''

    // Add custom message if provided
    if (custom_message) {
      aiMessage += `\n\nNote: ${custom_message}`
    }

    res.status(200).json({ 
      message: aiMessage, 
      ai_generated: true,
      tokens_used: response.usage?.total_tokens || 0
    })

  } catch (error) {
    console.error('AI message generation failed:', error)
    
    // Fallback message
    const fallbackMessage = `${urgencyPrefix} ${business_name} needs ${required_skill} coverage for ${formattedDate}, ${shift_start}-${shift_end}. Can you help?`
    
    res.status(200).json({ 
      message: fallbackMessage, 
      ai_generated: false,
      error: 'AI generation failed, using fallback'
    })
  }
}