import { useCallback, useMemo, useState } from "react";
import { usePrevious } from "../hooks/usePrevious";
import { APIRequestData, APIResponseData, APIError, APIAction } from "./types";

export function useApi<RES extends APIResponseData = APIResponseData, REQ extends APIRequestData = APIRequestData>(apiAction: APIAction<RES, REQ>) {
  const [data, setData] = useState<RES | null>(null);
  const [error, setError] = useState<APIError | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const prevLoading = usePrevious(loading);

  // Returns the response on success so callers that need the result *right now* (e.g.
  // building a share link to copy inside a click gesture) can await it directly, while
  // fire-and-forget callers keep reading from the data/error/loading state as before.
  // On failure it resolves to undefined rather than throwing, so those un-awaited
  // callers never produce an unhandled rejection — errors are still surfaced via state.
  const requestHandler = useCallback(async (req: REQ): Promise<RES | undefined> => {
    setLoading(true);
    try {
      const result = await apiAction(req);
      setData(result);
      setError(null);
      return result;
    } catch (e: any) {
      const apiError: APIError = {
        status: e.status || 0,
        message: e.message || 'Unknown error',
      }
      setData(null);
      setError(apiError);
      return undefined;
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const api = useMemo(() => ({
    data,
    error,
    loading,
    completedThisFrame: !loading && !!prevLoading,
    request: requestHandler,
  }), [data, error, loading, prevLoading, requestHandler]);

  return api;
};
