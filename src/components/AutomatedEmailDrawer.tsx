import React, { useState } from 'react';
import { 
  X, 
  Mail, 
  Send, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  RefreshCw,
  Bell,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const AutomatedEmailDrawer: React.FC = () => {
  const { 
    emailDrawerOpen, 
    setEmailDrawerOpen, 
    user, 
    userProfile, 
    recentEmails, 
    sendAutomatedEmail,
    toggleEmailNotifications 
  } = useAuth();

  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [isSendingTestMail, setIsSendingTestMail] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  if (!emailDrawerOpen) return null;

  const handleSendTestSummary = async () => {
    if (!user || !user.email) return;
    setIsSendingTestMail(true);
    try {
      await sendAutomatedEmail({
        recipientEmail: user.email,
        recipientUid: user.uid,
        subject: `TestCraft AI Automated Digest — ${new Date().toLocaleDateString()}`,
        type: 'weekly_summary',
        bodyText: `Automated Examination System Notice:\n\nHello ${user.displayName || 'Instructor'},\n\nThis is an automated status email dispatched to ${user.email}.\n\nYour account has active test monitoring enabled. When candidates submit their papers, conceptual grading will run automatically and deliver instant summaries right to your inbox.\n\nAll test papers created in this session are secured under your Google Account.`
      });
      setSuccessToast(`Automated email successfully dispatched to ${user.email}!`);
      setTimeout(() => setSuccessToast(null), 3500);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSendingTestMail(false);
    }
  };

  const selectedEmail = recentEmails.find(e => e.id === selectedEmailId) || recentEmails[0];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-xl h-full bg-white shadow-2xl flex flex-col border-l border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base font-display">
                Automated Email Center
              </h3>
              <p className="text-xs text-slate-500">
                Dispatched to <span className="font-mono text-indigo-700">{user?.email}</span>
              </p>
            </div>
          </div>

          <button
            onClick={() => setEmailDrawerOpen(false)}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-full transition-colors cursor-pointer"
            aria-label="Close email drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status bar */}
        <div className="p-4 bg-indigo-50/60 border-b border-indigo-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-slate-700">
              Automated Google Email Delivery: <strong>Active</strong>
            </span>
          </div>

          <button
            onClick={handleSendTestSummary}
            disabled={isSendingTestMail}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold shadow-2xs transition-all cursor-pointer"
          >
            {isSendingTestMail ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>Send Fresh Digest Now</span>
          </button>
        </div>

        {successToast && (
          <div className="m-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successToast}</span>
          </div>
        )}

        {/* Email list & preview */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {recentEmails.length === 0 ? (
            <div className="text-center py-16 px-4 text-slate-400 space-y-3">
              <Mail className="w-12 h-12 mx-auto text-slate-300" />
              <h4 className="font-bold text-slate-700 text-sm">No Automated Emails Yet</h4>
              <p className="text-xs max-w-xs mx-auto text-slate-500">
                Automated emails are sent automatically when you publish a test or when students submit their answers.
              </p>
              <button
                onClick={handleSendTestSummary}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-sm hover:bg-indigo-700"
              >
                Send Welcome Digest
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Delivered Automated Emails ({recentEmails.length})
              </span>

              {recentEmails.map(mail => (
                <div
                  key={mail.id}
                  className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 shadow-2xs space-y-2 transition-all"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                        From: TestCraft AI Official
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Delivered to {mail.recipientEmail}
                      </span>
                    </div>

                    <span className="text-[11px] text-slate-400 flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3" />
                      {new Date(mail.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(mail.sentAt).toLocaleDateString()}
                    </span>
                  </div>

                  <h5 className="font-bold text-slate-900 text-sm">
                    {mail.subject}
                  </h5>

                  <p className="text-xs text-slate-600 whitespace-pre-line bg-slate-50 p-3 rounded-xl border border-slate-100 font-sans leading-relaxed">
                    {mail.bodyText}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 text-center text-xs text-slate-400">
          Emails are automatically routed to your Google account inbox ({user?.email})
        </div>
      </div>
    </div>
  );
};
