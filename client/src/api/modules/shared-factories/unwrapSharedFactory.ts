// The shared-factory GET envelope shape lives in exactly one place. The API returns
// `{ data: { factory_config } }` and axios wraps that under `response.data`, so the
// wire config sits at `response.data.data.factory_config`. Both the useGetSharedFactory
// hook and the multi-share receive path (which calls the raw `get` so it can fan out
// with Promise.allSettled) unwrap through here.
export function unwrapSharedFactoryConfig(response: { data?: { data?: { factory_config?: any } } } | undefined): any {
  return response?.data?.data?.factory_config;
}
