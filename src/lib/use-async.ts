import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  data: T | undefined;
  // The failure message; "" while loading or after success
  error: string;
  // True until the first result (or error) arrives, and again after reload()
  loading: boolean;
  reload: () => void;
}

// Runs `load` on mount and whenever `deps` change, and again on reload(). A slow older request can never
// overwrite a newer one. Used where a screen needs "loading / failed (with retry) / loaded" for one request.
export function useAsync<T>(load: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [key, setKey] = useState(0);
  const latest = useRef(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    const request = ++latest.current;
    setLoading(true);
    setError("");
    loadRef
      .current()
      .then((value) => {
        if (request !== latest.current) return;
        setData(value);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (request !== latest.current) return;
        setError(err instanceof Error && err.message ? err.message : "Something went wrong. Please try again.");
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ...deps]);

  const reload = useCallback(() => setKey((current) => current + 1), []);
  return { data, error, loading, reload };
}
