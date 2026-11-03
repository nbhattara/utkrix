import { useEffect, useState } from "react";
import { getApiList } from "../api/client.js";

export function useApiList(path) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [totalPages, setTotalPages] = useState(1);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");

    getApiList(path, { signal: controller.signal })
      .then(({ items: result, totalPages: pageCount }) => {
        setItems(result);
        setTotalPages(pageCount);
      })
      .catch((requestError) => {
        if (requestError.name !== "AbortError") {
          setError(requestError.message || "Unable to load this content.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [path, attempt]);

  return {
    items,
    loading,
    error,
    totalPages,
    retry: () => setAttempt((current) => current + 1),
  };
}
