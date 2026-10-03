import React, { useState } from 'react';
import { X, ShieldCheck, FileText, Lock, Mail, HelpCircle, CheckCircle, ExternalLink, AlertCircle } from 'lucide-react';
import { Logo } from './Logo';

export type LegalModalTab = 'privacy' | 'terms' | 'about' | 'security';

interface LegalTrustModalProps {
  isOpen: boolean;
  initialTab?: LegalModalTab;
  onClose: () => void;
}

export const LegalTrustModal: React.FC<LegalTrustModalProps> = ({
  isOpen,
  initialTab = 'privacy',
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<LegalModalTab>(initialTab);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <div>
              <h3 className="text-base font-extrabold text-slate-900 font-display">
                Trust, Privacy &amp; Legal Center
              </h3>
              <p className="text-xs text-slate-500">
                Official transparency &amp; data safety information for TestCraft AI
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-full transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-white px-6 gap-2 sm:gap-4 overflow-x-auto text-xs font-bold">
          <button
            onClick={() => setActiveTab('privacy')}
            className={`py-3 px-2 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'privacy'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Privacy Policy</span>
          </button>
          <button
            onClick={() => setActiveTab('terms')}
            className={`py-3 px-2 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'terms'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Terms of Service</span>
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`py-3 px-2 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'security'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Security &amp; Safety</span>
          </button>
          <button
            onClick={() => setActiveTab('about')}
            className={`py-3 px-2 border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'about'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>About &amp; Developer</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 text-xs text-slate-600 leading-relaxed">
          {activeTab === 'privacy' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-extrabold text-sm">Commitment to Data Privacy</h4>
                  <p className="text-[11px] mt-0.5 text-emerald-800">
                    TestCraft AI (testcraftai.online) is a free educational platform. We do not sell data, do not display commercial ads, and never ask for credit cards or financial information.
                  </p>
                </div>
              </div>

              <section className="space-y-1.5">
                <h4 className="font-bold text-slate-900 text-sm">1. Information We Collect</h4>
                <p>
                  <strong>Instructor Accounts:</strong> When signing in with Google or Email, we store your email address, display name, and unique user identifier (UID) provided by Google Firebase Authentication to associate test papers you create with your account.
                </p>
                <p>
                  <strong>Student Test Takers:</strong> Students do NOT need to create an account. When taking a test link, students optionally input their candidate name and roll number so the teacher can grade their submission.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-slate-900 text-sm">2. How Data is Used &amp; Stored</h4>
                <p>
                  All test papers and answers are stored securely in Google Cloud Firebase Firestore databases with enterprise-grade encryption in transit and at rest. Data is used exclusively to display test questions, calculate marks, and evaluate conceptual theory answers.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-slate-900 text-sm">3. No Selling or Commercial Sharing of Data</h4>
                <p>
                  We strictly never sell, rent, or monetize personal information, student answers, or teacher data to third-party data brokers or advertisers.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-slate-900 text-sm">4. Contact Information</h4>
                <p>
                  For privacy inquiries or deletion requests, contact our developer team at{' '}
                  <a href="mailto:byabdullahkhan@gmail.com" className="text-indigo-600 font-bold underline">
                    byabdullahkhan@gmail.com
                  </a>.
                </p>
              </section>
            </div>
          )}

          {activeTab === 'terms' && (
            <div className="space-y-4">
              <section className="space-y-1.5">
                <h4 className="font-bold text-slate-900 text-sm">1. Non-Commercial Educational License</h4>
                <p>
                  TestCraft AI is provided as a 100% free educational assessment utility designed to empower teachers, professors, educational coaching institutes, and students.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-slate-900 text-sm">2. Acceptable Use Policy</h4>
                <p>
                  You agree to use TestCraft AI strictly for legitimate educational, assessment, and testing purposes. You agree not to upload abusive, harmful, defamatory, or unlawful content into test papers.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-slate-900 text-sm">3. Intellectual Property of Content</h4>
                <p>
                  Educators retain full copyright and ownership of the examination questions and curriculum they craft and publish on the platform.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-slate-900 text-sm">4. Disclaimer of Warranty</h4>
                <p>
                  TestCraft AI is provided &ldquo;as is&rdquo; without warranties of any kind. AI evaluation provides assistive grading based on instructor model answers and should be reviewed by instructors for high-stakes examinations.
                </p>
              </section>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl text-blue-900 flex items-start gap-2.5">
                <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-extrabold text-sm">Legitimate Educational Service</h4>
                  <p className="text-[11px] mt-0.5 text-blue-800">
                    Automated domain ranking algorithms (like ScamAdviser or IPQS) sometimes flag brand-new domains with automated low scores purely because the domain is newly registered. TestCraft AI is a legitimate, verified educational tool.
                  </p>
                </div>
              </div>

              <section className="space-y-1.5">
                <h4 className="font-bold text-slate-900 text-sm">Security Infrastructure</h4>
                <ul className="list-disc pl-4 space-y-1 text-slate-600">
                  <li><strong>Zero Financial Transactions:</strong> We do NOT take credit cards, payments, or banking info. The platform is completely free.</li>
                  <li><strong>SSL / TLS Encryption:</strong> All connections are forced over HTTPS via Cloudflare and GitHub Pages global CDN with modern TLS 1.3 certificates.</li>
                  <li><strong>Google Firebase Security Rules:</strong> Database operations are isolated and protected through role-based access rules.</li>
                  <li><strong>No Spam or Malware:</strong> Verified clean by Google Safe Browsing and DNSFilter.</li>
                </ul>
              </section>
            </div>
          )}

          {activeTab === 'about' && (
            <div className="space-y-4">
              <section className="space-y-1.5">
                <h4 className="font-bold text-slate-900 text-sm">About TestCraft AI</h4>
                <p>
                  TestCraft AI was developed by educator and software engineer <strong>Abdullah Khan</strong> to solve a real educational problem: giving teachers an instant, effortless way to create online tests with automatic MCQ scoring and AI-assisted conceptual theory grading, without forcing students to sign up or download apps.
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-slate-900 text-sm">Developer &amp; Project Verification</h4>
                <ul className="list-disc pl-4 space-y-1 text-slate-600">
                  <li><strong>Website:</strong> <span className="font-mono text-indigo-700">https://testcraftai.online</span></li>
                  <li><strong>Developer:</strong> Abdullah Khan</li>
                  <li><strong>Contact Email:</strong> <a href="mailto:byabdullahkhan@gmail.com" className="text-indigo-600 font-bold underline">byabdullahkhan@gmail.com</a></li>
                  <li><strong>GitHub:</strong> <a href="https://github.com/byabdullahkhan" target="_blank" rel="noopener noreferrer" className="text-indigo-600 font-bold underline inline-flex items-center gap-1">github.com/byabdullahkhan <ExternalLink className="w-3 h-3" /></a></li>
                </ul>
              </section>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span>Last Updated: October 2026 • TestCraft AI</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
