import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { useAuth } from '../contexts/AuthContext';

vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('./Layout', () => ({ Layout: ({ children }: { children: React.ReactNode }) => children }));

const departmentHead = {
  id: 'head-1',
  idNumber: 'head@maia.test',
  name: 'Head',
  email: 'head@maia.test',
  role: 'department_head' as const,
  department: 'Engineering',
};

function renderRoute(
  auth: { user: typeof departmentHead | null; isLoading: boolean },
  props: { allowedRoles?: readonly ('professor' | 'department_head')[]; requireAdministrator?: boolean } = {},
) {
  vi.mocked(useAuth).mockReturnValue(auth as ReturnType<typeof useAuth>);
  render(
    <MemoryRouter initialEntries={['/restricted']}>
      <Routes>
        <Route
          path="/restricted"
          element={<ProtectedRoute {...props}><div>private</div></ProtectedRoute>}
        />
        <Route path="/login" element={<div>login</div>} />
        <Route path="/dashboard" element={<div>dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  it('redirects anonymous users to login', () => {
    renderRoute({ user: null, isLoading: false });
    expect(screen.getByText('login')).toBeInTheDocument();
  });

  it('redirects users with the wrong role to their dashboard', () => {
    renderRoute(
      { user: departmentHead, isLoading: false },
      { allowedRoles: ['professor'] },
    );
    expect(screen.getByText('dashboard')).toBeInTheDocument();
  });

  it('requires the administrator flag for administrator routes', () => {
    renderRoute(
      { user: departmentHead, isLoading: false },
      { allowedRoles: ['department_head'], requireAdministrator: true },
    );
    expect(screen.getByText('dashboard')).toBeInTheDocument();
  });

  it('renders an authorized route', () => {
    renderRoute(
      { user: { ...departmentHead, isAdministrator: true }, isLoading: false },
      { allowedRoles: ['department_head'], requireAdministrator: true },
    );
    expect(screen.getByText('private')).toBeInTheDocument();
  });
});
