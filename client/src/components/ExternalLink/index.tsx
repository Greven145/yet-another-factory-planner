import React from 'react';
import { Anchor, AnchorProps, ElementProps } from '@mantine/core';

const ExternalLink = (props: AnchorProps & ElementProps<'a'>) => {
  return <Anchor target='_blank' rel='noopener noreferrer' inherit {...props} />;
};

export default ExternalLink;
