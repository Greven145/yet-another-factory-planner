import React from 'react';
import styled from 'styled-components';
import { Anchor } from '@mantine/core';
import { IconProp } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

interface Props {
  href: string;
  icon: IconProp;
  fontSize?: number;
}

const SocialIcon: React.FC<Props> = ({ href, icon, fontSize }) => (
    <SAnchor href={href} target='_blank' rel='noopener noreferrer'>
      <FontAwesomeIcon icon={icon} style={{ fontSize }} />
    </SAnchor>
);

export default SocialIcon;

const SAnchor: any = styled(Anchor)`
  display: flex;
  align-items: center;
  justify-content: center;
  color: #f0f0f0;

  &:hover {
    color: #ddd;
  }
`;
