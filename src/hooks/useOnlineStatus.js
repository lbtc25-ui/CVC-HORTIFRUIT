import { useEffect, useState } from "react";

/** true/false conforme o navegador enxerga a conexão. */
export function useOnlineStatus() {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine
  );

  useEffect(() => {
    const subiu = () => setOnline(true);
    const caiu = () => setOnline(false);
    window.addEventListener("online", subiu);
    window.addEventListener("offline", caiu);
    return () => {
      window.removeEventListener("online", subiu);
      window.removeEventListener("offline", caiu);
    };
  }, []);

  return online;
}

export default useOnlineStatus;
