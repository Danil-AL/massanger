const TOKEN_KEY = "pulse_token";

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const saveToken = (token) => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

async function request(path, { method = "GET", body, auth = true } = {}) {
  const token = getToken();
  const response = await fetch(`/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  let data = {};
  try {
    data = await response.json();
  } catch {}

  if (!response.ok) {
    const error = new Error(data.message || "Что-то пошло не так");
    error.status = response.status;
    error.code = data.code;
    error.data = data;
    throw error;
  }
  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  delete: (path) => request(path, { method: "DELETE" }),
  register: (body) =>
    request("/auth/register", { method: "POST", body, auth: false }),
  verify: (body) =>
    request("/auth/verify", { method: "POST", body, auth: false }),
  resendCode: (body) =>
    request("/auth/resend-code", { method: "POST", body, auth: false }),
  login: (body) =>
    request("/auth/login", { method: "POST", body, auth: false }),
};
