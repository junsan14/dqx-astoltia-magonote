export function removeLocalePrefix(pathname = "") {
  return pathname.replace(/^\/(ja|en)(?=\/|$)/, "") || "/";
}

export function isAdminPath(pathname = "") {
  const path = removeLocalePrefix(pathname);

  return path === "/admin" || path.startsWith("/admin/");
}