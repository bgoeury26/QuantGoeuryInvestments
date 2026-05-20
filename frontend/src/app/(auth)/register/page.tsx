'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth.store';
import { TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { register, isLoading } = useAuthStore();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await register(name, email, password);
      setSuccess(true);
      setTimeout(() => router.push('/pending'), 2000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Registration failed.');
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-semibold text-text">QuantGoeury</span>
        </div>
        <div className="card p-8">
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-text mb-1">Request Access</h1>
            <p className="text-sm text-muted">Approval required from platform administrator</p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-danger/10 border border-danger/20 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
              <span className="text-sm text-danger">{error}</span>
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 rounded-lg bg-success/10 border border-success/20 flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-success shrink-0 mt-0.5" />
              <span className="text-sm text-success">Account created. Awaiting approval...</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Full Name</label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
                className="input" placeholder="Benjamin Goeury" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="input" placeholder="you@example.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted mb-1.5">Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="input" placeholder="Min 8 characters" minLength={8} />
            </div>
            <button type="submit" disabled={isLoading || success}
              className="btn-primary w-full justify-center flex items-center gap-2 h-10">
              {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Request Access'}
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-muted">
            Already have access?{' '}
            <Link href="/login" className="text-primary hover:text-primary-hover">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
