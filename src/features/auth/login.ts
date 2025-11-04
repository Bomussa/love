// src/features/auth/login.ts
import { api } from '@/lib/api';
export type LoginPayload = { id: string; gender: 'M' | 'F' };
export async function login(payload: LoginPayload) {
  const { ok, status, data } = await api('/v1/login', { method: 'POST', json: payload });
  if (!ok) {
    const msg =
      status === 401 ? 'بيانات غير صحيحة' :
      status === 403 ? 'غير مصرح' :
      status >= 500 ? 'مشكلة خادم' :
      'تعذّر تسجيل الدخول (Front)';
    throw new Error(msg);
  }
  if ((data as any)?.token && typeof window !== 'undefined') {
    sessionStorage.setItem('mms_token', (data as any).token);
  }
  return data;
}
