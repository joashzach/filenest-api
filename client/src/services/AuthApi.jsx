import { request, setToken } from './api';

/**
 * Authentication API service
 */

export async function signup({ name, email, password }) {
  const data = await request('/auth/signup', {
    method: 'POST',
    body: { name, email, password },
  });
  if (data.token) {
    setToken(data.token);
  }
  return data;
}

export async function login({ email, password }) {
  const data = await request('/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  if (data.token) {
    setToken(data.token);
  }
  return data;
}

export async function getMe() {
  return request('/users/me', { auth: true });
}

export async function updateMe({ name, email }) {
  return request('/users/updateMe', {
    method: 'PATCH',
    auth: true,
    body: { name, email },
  });
}

export async function updatePassword({ currentPassword, newPassword }) {
  const data = await request('/users/updatePassword', {
    method: 'POST',
    auth: true,
    body: { currentPassword, newPassword },
  });
  if (data.token) {
    setToken(data.token);
  }
  return data;
}

