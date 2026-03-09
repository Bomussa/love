import { describe, expect, it, vi } from 'vitest';
import {
  createSensitiveActionGuard,
  filterClinicsByScope,
  getForbiddenMessage,
  resolveAdminAccessScope,
} from '../admin-access-guard';

const clinics = [
  { id: 'DERM', name_ar: 'الجلدية' },
  { id: 'LAB', name_ar: 'المختبر' },
];

describe('admin access guard', () => {
  it('allows super admin to access all clinics and sensitive actions', () => {
    const scope = resolveAdminAccessScope({
      session: { role: 'SUPER_ADMIN', assigned_clinic: null },
      canAccessClinicOnly: false,
    });

    const denied = vi.fn();
    const guard = createSensitiveActionGuard({ scope, onDenied: denied });

    expect(scope.canManageAllClinics).toBe(true);
    expect(filterClinicsByScope(clinics, scope)).toHaveLength(2);
    expect(guard({ requiresGlobalScope: true })).toBe(true);
    expect(denied).not.toHaveBeenCalled();
  });

  it('limits single-clinic admin to assigned clinic only', () => {
    const scope = resolveAdminAccessScope({
      session: { role: 'ADMIN', assigned_clinic: 'DERM' },
      canAccessClinicOnly: true,
    });

    const denied = vi.fn();
    const guard = createSensitiveActionGuard({ scope, onDenied: denied });

    expect(scope.canManageAllClinics).toBe(false);
    expect(filterClinicsByScope(clinics, scope).map((c) => c.id)).toEqual(['DERM']);
    expect(guard({ clinicId: 'DERM' })).toBe(true);
    expect(guard({ clinicId: 'LAB' })).toBe(false);
    expect(guard({ requiresGlobalScope: true })).toBe(false);
    expect(denied).toHaveBeenCalledTimes(2);
  });

  it('shows consistent bilingual 403 message for restricted reviewer', () => {
    const scope = resolveAdminAccessScope({
      session: { role: 'REVIEWER', assigned_clinic: 'LAB' },
      canAccessClinicOnly: true,
    });

    const denied = vi.fn();
    const guard = createSensitiveActionGuard({ scope, onDenied: denied });

    expect(guard({ requiresGlobalScope: true })).toBe(false);
    expect(getForbiddenMessage('ar')).toContain('403');
    expect(getForbiddenMessage('en')).toContain('403');
    expect(denied).toHaveBeenCalledTimes(1);
  });
});
