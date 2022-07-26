import './TokenControl.less';

import { AssetInfo } from '@ergolabs/ergo-sdk';
import { Form } from 'antd';
import cn from 'classnames';
import React, { FC, ReactNode, useEffect } from 'react';
import { of } from 'rxjs';

import { Box, Button, Flex, Typography } from '../../../ergodex-cdk';
import { useObservableAction } from '../../../hooks/useObservable';
import { getBalanceByTokenId } from '../../../services/new/balance';
import {
  TokenAmountInput,
  TokenAmountInputValue,
} from './TokenAmountInput/TokenAmountInput';
import { TokenSelect } from './TokenSelect/TokenSelect';

export interface TokenControlValue {
  amount?: TokenAmountInputValue;
  asset?: AssetInfo;
}

export interface TokenControlProps {
  readonly label?: ReactNode;
  readonly value?: TokenControlValue;
  readonly onChange?: (value: TokenControlValue) => void;
  readonly maxButton?: boolean;
  readonly hasBorder?: boolean;
  readonly assets?: AssetInfo[];
  readonly disabled?: boolean;
  readonly readonly?: boolean | 'asset' | 'amount';
  readonly noBottomInfo?: boolean;
  readonly bordered?: boolean;
}

const getTokenBalanceByTokenName = (tokenName: string | undefined) =>
  tokenName ? getBalanceByTokenId(tokenName) : of(undefined);

export const TokenControl: FC<TokenControlProps> = ({
  label,
  value,
  onChange,
  assets,
  hasBorder,
  disabled,
  readonly,
  noBottomInfo,
  bordered,
}) => {
  const [balance, updateBalance] = useObservableAction(
    getTokenBalanceByTokenName,
  );

  useEffect(() => {
    if (value?.asset) {
      updateBalance(value?.asset?.id);
    } else {
      updateBalance(undefined);
    }
  }, [value, updateBalance]);

  const onAmountChange = (amount: TokenAmountInputValue) => {
    if (onChange) {
      onChange({ ...value, amount });
    }
  };

  const onTokenChange = (asset: AssetInfo) => {
    if (onChange) {
      onChange({ ...value, asset });
    }
  };

  return (
    <Box
      className={cn({
        'token-control--bordered': bordered,
        'token-control--has-border': hasBorder,
      })}
      padding={4}
      borderRadius="l"
      gray
    >
      <Flex flexDirection="col">
        <Flex.Item marginBottom={2}>
          <Typography.Body type="secondary">{label}</Typography.Body>
        </Flex.Item>

        <Flex.Item marginBottom={noBottomInfo ? 0 : 2}>
          <Flex flexDirection="row">
            <Flex.Item marginRight={2} flex={1}>
              <TokenAmountInput
                readonly={!!readonly && readonly !== 'asset'}
                value={value?.amount}
                decimals={value?.asset?.decimals}
                onChange={onAmountChange}
                disabled={disabled}
              />
            </Flex.Item>
            <Flex.Item>
              <TokenSelect
                assets={assets}
                readonly={!!readonly && readonly !== 'amount'}
                value={value?.asset}
                onChange={onTokenChange}
                disabled={disabled}
              />
            </Flex.Item>
          </Flex>
        </Flex.Item>
      </Flex>
    </Box>
  );
};

export interface TokenControlFormItemProps {
  readonly name: string;
  readonly label?: ReactNode;
  readonly hasBorder?: boolean;
  readonly assets?: AssetInfo[];
  readonly disabled?: boolean;
  readonly readonly?: boolean | 'asset' | 'amount';
  readonly noBottomInfo?: boolean;
  readonly bordered?: boolean;
}

export const TokenControlFormItem: FC<TokenControlFormItemProps> = ({
  label,
  name,
  assets,
  hasBorder,
  disabled,
  readonly,
  noBottomInfo,
  bordered,
}) => {
  return (
    <Form.Item name={name} className="token-form-item">
      <TokenControl
        bordered={bordered}
        noBottomInfo={noBottomInfo}
        readonly={readonly}
        assets={assets}
        label={label}
        hasBorder={hasBorder}
        disabled={disabled}
      />
    </Form.Item>
  );
};
