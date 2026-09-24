// The app can be served from a sub-path (e.g. https://host/rekyc/) instead of
// the domain root. Vite exposes that path as BASE_URL ('/' by default, always
// ending in '/'). Everything that builds an absolute URL by hand goes through
// here so it keeps working under any base path.
export const BASE_URL = import.meta.env.BASE_URL || '/';

// React Router wants the prefix without a trailing slash.
export const ROUTER_BASENAME = BASE_URL === '/' ? '/' : BASE_URL.replace(/\/$/, '');

// '/rekyc/' + 'login' -> '/rekyc/login'
export const appUrl = (path = '') => `${BASE_URL}${String(path).replace(/^\//, '')}`;

// Full URL including origin, for redirects handed to third parties (DigiLocker etc.).
export const appAbsoluteUrl = (path = '') => `${window.location.origin}${appUrl(path)}`;
