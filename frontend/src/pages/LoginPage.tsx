import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { useAuth } from '@/contexts/AuthContext';
import { apiErrorMessage } from '@/lib/api';

interface FormValues {
  email: string;
  password: string;
}

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>();

  useEffect(() => {
    document.title = 'Login — DAMS';
  }, []);

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      await login(values.email.trim().toLowerCase(), values.password);
      const redirectTo = (location.state as { from?: { pathname: string } } | null)?.from?.pathname || '/dashboard';
      navigate(redirectTo, { replace: true });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Login failed',
        text: apiErrorMessage(err, 'Invalid email or password'),
        confirmButtonColor: '#4f46e5',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="text-center mb-6">
          <div
            style={{
              width: 64,
              height: 64,
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              borderRadius: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
            }}
          >
            <i className="fas fa-user-check fa-lg" style={{ color: 'white' }} />
          </div>
          <h1 style={{ marginTop: 20, fontSize: '1.5rem' }}>Welcome Back</h1>
          <p className="text-muted text-sm" style={{ marginTop: 4 }}>
            Sign in to Digital Attendance Management System
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              className="form-control"
              placeholder="name@school.com"
              autoComplete="email"
              {...register('email', { required: 'Email is required' })}
            />
            {errors.email && <small style={{ color: 'var(--danger)' }}>{errors.email.message}</small>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="form-control"
                placeholder="Enter your password"
                autoComplete="current-password"
                {...register('password', { required: 'Password is required' })}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 4,
                }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <i className={`far ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} />
              </button>
            </div>
            {errors.password && <small style={{ color: 'var(--danger)' }}>{errors.password.message}</small>}
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg w-full"
            style={{ marginTop: 8 }}
            disabled={submitting}
          >
            {submitting ? (
              <><i className="fas fa-spinner fa-spin" /> Signing in…</>
            ) : (
              <><i className="fas fa-sign-in-alt" /> Sign In</>
            )}
          </button>
        </form>

        <div className="text-center mt-6">
          <p className="text-muted text-xs">Forgot password? Contact your school administrator</p>
        </div>
      </div>
    </div>
  );
}
