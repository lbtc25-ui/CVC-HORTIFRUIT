import { useEffect, useState } from "react";
import { estadoSync, observarSync } from "../lib/sync";

/** Estado do motor de sincronização (online, pendentes, falhas, última sync...). */
export function useSyncStatus() {
  const [status, setStatus] = useState(estadoSync);
  useEffect(() => observarSync(setStatus), []);
  return status;
}

export default useSyncStatus;
