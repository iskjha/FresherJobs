import axios from 'axios';
import { API_BASE_URL } from '@/config';

// Single shared axios instance — every api/*Api.js module uses this.
const axiosClient = axios.create({
  baseURL: API_BASE_URL.replace(/\/?$/, '/'),
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

const MAX_RETRIES = 4;
const RETRYABLE = new Set([502, 503, 504]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

axiosClient.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (axios.isCancel(err)) return Promise.reject(err);

    // API restarting / briefly unreachable: retry with backoff (0.5s → 4s).
    // Every endpoint the UI calls is a read, so retries are safe.
    const config = err.config;
    const transient = !err.response || RETRYABLE.has(err.response.status);
    if (config && transient && (config.__retries || 0) < MAX_RETRIES && !config.signal?.aborted) {
      config.__retries = (config.__retries || 0) + 1;
      await sleep(500 * 2 ** (config.__retries - 1));
      return axiosClient(config);
    }

    const serverMessage = err.response?.data?.error;
    const message = err.response
      ? serverMessage || `Request failed (HTTP ${err.response.status})`
      : 'Cannot reach the API server — is it running?';
    const wrapped = new Error(message);
    wrapped.status = err.response?.status;
    return Promise.reject(wrapped);
  }
);

export default axiosClient;
