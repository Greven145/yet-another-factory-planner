import { post } from '../..';
import { useApi } from "../../useApi";
import { FactoryOptions } from '../../../contexts/production/types';
import { encode } from '../../../utilities/shared-factory/codec';

interface PostSharedFactoryRequest {
  gameVersion: string,
  factoryConfig: FactoryOptions,
}

interface PostSharedFactoryResponse {
  key: string,
}

export function usePostSharedFactory() {
  return useApi<PostSharedFactoryResponse, PostSharedFactoryRequest>(async (req) => {
    const body = {
      factoryConfig: encode(req.factoryConfig, req.gameVersion),
    };
    const res = await post('/share-factory', body);
    const json = res.data;
    return json.data;
  });
}
