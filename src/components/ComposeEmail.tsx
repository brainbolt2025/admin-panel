import { useState, type FormEvent } from 'react'
import { Send, CheckCircle2 } from 'lucide-react'
import { getAuthenticatedSupabase } from '../lib/supabase'
import { config } from '../config'
import { toUserFacingError } from '../lib/userFacingError'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const ComposeEmail = () => {
  const [to, setTo] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const canSend = EMAIL_RE.test(to.trim()) && subject.trim() && message.trim() && !sending

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!canSend) return

    setSending(true)
    setError(null)
    setSuccess(null)

    try {
      const supabaseClient = getAuthenticatedSupabase()
      const {
        data: { session },
      } = await supabaseClient.auth.getSession()

      if (!session) {
        throw new Error('Not authenticated')
      }

      const response = await fetch(config.api.sendSingleEmail, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          to: to.trim(),
          subject: subject.trim(),
          message: message.trim(),
        }),
      })

      const result = (await response.json().catch(() => ({}))) as {
        success?: boolean
        error?: string
        message?: string
      }

      if (!response.ok || result.success === false) {
        throw new Error(result.error || result.message || 'Failed to send email')
      }

      setSuccess(result.message || `Email sent to ${to.trim()}`)
      setTo('')
      setSubject('')
      setMessage('')
    } catch (err) {
      console.error('Error sending email:', err)
      setError(toUserFacingError(err, 'Unable to send email. Please try again.'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Send Email</h1>
        <p className="mt-1 text-gray-600">
          Write a one-off email to a single recipient. Sends from JP from Asine
          &lt;jp@sycnmore.com&gt;.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="max-w-2xl space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      >
        <div>
          <label htmlFor="compose-to" className="mb-2 block text-sm font-medium text-gray-700">
            To *
          </label>
          <input
            id="compose-to"
            type="email"
            required
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="recipient@example.com"
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-teal-500"
            disabled={sending}
          />
        </div>

        <div>
          <label htmlFor="compose-subject" className="mb-2 block text-sm font-medium text-gray-700">
            Subject *
          </label>
          <input
            id="compose-subject"
            type="text"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Enter email subject"
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-teal-500"
            disabled={sending}
          />
        </div>

        <div>
          <label htmlFor="compose-message" className="mb-2 block text-sm font-medium text-gray-700">
            Message *
          </label>
          <textarea
            id="compose-message"
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Enter email message (supports line breaks)"
            rows={10}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-teal-500"
            disabled={sending}
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>
        )}

        {success && (
          <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <p className="font-medium">{success}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={!canSend}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-6 py-2 text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {sending ? (
            <>
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Sending...
            </>
          ) : (
            <>
              <Send className="h-5 w-5" />
              Send Email
            </>
          )}
        </button>
      </form>
    </div>
  )
}

export default ComposeEmail
