import { Clock, Mail } from 'lucide-react';
import Link from 'next/link';

export default function PendingPage() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="w-16 h-16 rounded-full bg-warning/10 border border-warning/20 flex items-center justify-center mx-auto mb-6">
          <Clock className="w-8 h-8 text-warning" />
        </div>
        <h1 className="text-2xl font-semibold text-text mb-2">Pending Approval</h1>
        <p className="text-muted mb-6 max-w-sm mx-auto">
          Your account has been created and is awaiting approval from the platform administrator.
          You will receive a notification once approved.
        </p>
        <div className="card p-4 flex items-center gap-3 text-left mb-6">
          <Mail className="w-5 h-5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-medium text-text">Administrator</p>
            <p className="text-xs text-muted">goeurybenjamin@gmail.com</p>
          </div>
        </div>
        <Link href="/login" className="text-sm text-primary hover:text-primary-hover">Back to sign in</Link>
      </div>
    </div>
  );
}
