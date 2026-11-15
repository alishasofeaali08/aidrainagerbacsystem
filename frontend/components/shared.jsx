import React from 'react';

export const API = import.meta.env.VITE_API_URL || '/api';
export const BACKEND_URL = 'https://air-eyes-ctrl-system.onrender.com/api';
export const MY_STATES = ["Johor","Kedah","Kelantan","Melaka","Negeri Sembilan","Pahang","Perak","Perlis","Pulau Pinang","Sabah","Sarawak","Selangor","Terengganu","Kuala Lumpur","Putrajaya","Labuan"];

export const getPhotoUrl = (path) => {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${BACKEND_URL}${path.startsWith('/') ? path : `/${path}`}`;
};

export async function req(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (!(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const token = localStorage.getItem('token');
  if (token) headers.Authorization = 'Bearer ' + token;
  const response = await fetch(API + path, { ...opts, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(data.detail || 'Request failed');
  return data;
}

export const SC = status => ({
  resolved:'#059669', pending_closure:'#8b5cf6', engineer_approved:'#1B8CA8',
  in_progress:'#d97706', reviewed:'#0891b2', rejected:'#dc2626'
}[status] || '#64748b');
export const PC = priority => priority <= 1 ? '#dc2626' : priority <= 2 ? '#ea580c' : priority <= 3 ? '#ca8a04' : priority <= 4 ? '#1B8CA8' : '#64748b';
export const SL = status => ({
  submitted:'Submitted', reviewed:'Reviewed', engineer_approved:'Engineer Approved',
  in_progress:'In Progress', pending_closure:'Pending Closure', resolved:'Resolved', rejected:'Rejected'
}[status] || status);

export function Badge({ label, color }) {
  return <span className="badge" style={{ background: color || '#64748b' }}>{label}</span>;
}
