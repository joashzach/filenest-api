const API_URL = import.meta.env.VITE_API_URL;

/**
 * Core API client. All backend requests go through here.
 * Handles auth headers, JSON parsing, and error normalization.
 */

function getToken() {
  return localStorage.getItem('filenest_token');
}

function setToken(token) {
  localStorage.setItem('filenest_token', token);
}

function removeToken() {
  localStorage.removeItem('filenest_token');
}

async function request(endpoint, options = {}) {
  const { body, method = 'GET', auth = false, raw = false } = options;

  const headers = {};

  if (!raw) {
    headers['Content-Type'] = 'application/json';
  }

  if (auth) {
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const config = {
    method,
    headers,
  };

  if (body && !raw) {
    config.body = JSON.stringify(body);
  } else if (body && raw) {
    config.body = body;
  }

  const response = await fetch(`${API_URL}${endpoint}`, config);

  if (!response.ok) {
    let errorMessage = 'Something went wrong. Please try again.';
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorMessage;
    } catch {
      // Response wasn't JSON
    }

    const error = new Error(errorMessage);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

export { getToken, setToken, removeToken, request };
