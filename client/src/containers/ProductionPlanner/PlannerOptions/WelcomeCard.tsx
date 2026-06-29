// The Welcome card, hosted at the top of the drawer (where the old Control Panel
// header used to be). The factory switcher lives in the main body (FactorySwitcher),
// so this only reclaims that vertical space with the greeting + FICSIT tip.
import React from 'react';
import { Title, Text, Divider } from '@mantine/core';
import { useGlobalContext } from '../../../contexts/global';
import Card from '../../../components/Card';

const WelcomeCard = () => {
  const globalCtx = useGlobalContext();
  return (
    <Card style={{ padding: '12px 14px' }}>
      <Title order={3}>Welcome back &lt;Engineer ID #{globalCtx.engineerId}&gt;</Title>
      <Text>
        This tool has been created to increase the efficiency of your work towards Project Assembly.<br />
        We hope that you will continue to be effective.
      </Text>
      <Divider style={{ marginTop: '10px', marginBottom: '10px' }} />
      <Text style={{ fontSize: '13px' }}>{globalCtx.ficsitTip}</Text>
    </Card>
  );
};

export default WelcomeCard;
