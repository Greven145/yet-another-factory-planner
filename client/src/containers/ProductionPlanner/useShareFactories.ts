import { useCallback, useState } from 'react';
import { usePostSharedFactory } from '../../api/modules/shared-factories/usePostSharedFactory';
import { LibraryFactory } from '../../contexts/library/types';
import { buildShareUrl } from '../../utilities/shared-factory/share-url';
import { useClipboardShare } from './useClipboardShare';

// Multi-factory Share: POST each selected factory, combine the keys into one link,
// and copy it. The clipboard lifecycle (and the #182 discipline) is shared with the
// single-factory hook via useClipboardShare; this hook only adds the batch POST and
// the sharedCount/totalCount shortfall reporting.
export function useShareFactories() {
  const post = usePostSharedFactory();
  const { status, link, copy } = useClipboardShare();
  const [sharedCount, setSharedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const onShare = useCallback((factories: LibraryFactory[]) => {
    setSharedCount(0);
    setTotalCount(factories.length);

    // ONE promise resolving to the final link. Each factory is encoded with its OWN
    // game version. Partial failure is fine: the link is built from the keys that came
    // back and sharedCount reports the shortfall; an empty result rejects so the
    // clipboard flow drops to the manual-copy field.
    const linkPromise = Promise.allSettled(
      factories.map((f) => post.request({ factoryConfig: f.config!, gameVersion: f.gameVersion })),
    ).then((results) => {
      const keys = results
        .filter((r): r is PromiseFulfilledResult<{ key: string } | undefined> => r.status === 'fulfilled')
        .map((r) => r.value?.key)
        .filter((k): k is string => !!k);
      setSharedCount(keys.length);
      if (!keys.length) throw new Error('No factories were shared');
      return buildShareUrl(keys);
    });

    return copy(linkPromise);
  }, [post, copy]);

  return { status, link, sharedCount, totalCount, onShare };
}
