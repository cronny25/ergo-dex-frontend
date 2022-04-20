/* eslint-disable @typescript-eslint/no-non-null-asserted-optional-chain */
import './Swap.less';

import { AmmPool } from '@ergolabs/ergo-dex-sdk';
import { AssetAmount, AssetInfo } from '@ergolabs/ergo-sdk';
import React, { FC, useEffect, useState } from 'react';
import { Observable, of } from 'rxjs';

import {
  ActionForm,
  ActionFormStrategy,
} from '../../components/common/ActionForm/ActionForm';
import {
  TokenControlFormItem,
  TokenControlValue,
} from '../../components/common/TokenControl/TokenControl';
import { TokenSelect } from '../../components/common/TokenControl/TokenSelect/TokenSelect';
import {
  openConfirmationModal,
  Operation,
} from '../../components/ConfirmationModal/ConfirmationModal';
import { FormPageWrapper } from '../../components/FormPageWrapper/FormPageWrapper';
import { NetworkDropdown } from '../../components/Header/NetworkDropdown/NetworkDropdown';
import {
  ERG_DECIMALS,
  ERG_TOKEN_ID,
  ERG_TOKEN_NAME,
  UI_FEE,
} from '../../constants/erg';
import { defaultExFee } from '../../constants/settings';
import { useSettings } from '../../context';
import { Flex, Form, FormInstance, Typography } from '../../ergodex-cdk';
import { useObservable, useObservableAction } from '../../hooks/useObservable';
import { assets$, getAssetsByPairAsset } from '../../services/new/assets';
import { Balance, useWalletBalance } from '../../services/new/balance';
import { getPoolByPair, pools$ } from '../../services/new/pools';
import { fractionsToNum, parseUserInputToFractions } from '../../utils/math';
import { calculateTotalFee } from '../../utils/transactions';
import { Ratio } from './Ratio';
import { SwapConfirmationModal } from './SwapConfirmationModal';

interface SwapFormModel {
  readonly from?: TokenControlValue;
  readonly to?: TokenControlValue;
  readonly pool?: AmmPool;
}

class SwapStrategy implements ActionFormStrategy {
  constructor(private balance: Balance, private minerFee: number) {}

  actionButtonCaption(): React.ReactNode {
    return 'Swap';
  }

  getInsufficientTokenForFee(
    form: FormInstance<SwapFormModel>,
  ): string | undefined {
    const { from } = form.getFieldsValue();
    let totalFees = +calculateTotalFee(
      [this.minerFee, UI_FEE, defaultExFee],
      ERG_DECIMALS,
    );
    totalFees =
      from?.asset?.id === ERG_TOKEN_ID
        ? totalFees + from.amount?.value!
        : totalFees;

    return +totalFees > this.balance.get(ERG_TOKEN_ID)
      ? ERG_TOKEN_NAME
      : undefined;
  }

  getInsufficientTokenForTx(
    form: FormInstance<SwapFormModel>,
  ): Observable<string | undefined> | string | undefined {
    const { from } = form.getFieldsValue();
    const asset = from?.asset;
    const amount = from?.amount?.value;

    if (asset && amount && amount > this.balance.get(asset)) {
      return asset.name;
    }

    return undefined;
  }

  isAmountNotEntered(form: FormInstance<SwapFormModel>): boolean {
    const value = form.getFieldsValue();

    return !value.from?.amount?.value || !value.to?.amount?.value;
  }

  isTokensNotSelected(form: FormInstance<SwapFormModel>): boolean {
    const value = form.getFieldsValue();

    return !value.to?.asset || !value.from?.asset;
  }

  request(form: FormInstance): void {
    const value = form.getFieldsValue();

    openConfirmationModal(
      (next) => {
        return <SwapConfirmationModal value={value} onClose={next} />;
      },
      Operation.SWAP,
      { asset: value.from?.asset!, amount: value?.from?.amount?.value! },
      { asset: value.to?.asset!, amount: value?.to?.amount?.value! },
    );
  }

  isLiquidityInsufficient(form: FormInstance<SwapFormModel>): boolean {
    const { to, pool } = form.getFieldsValue();

    if (!to?.amount?.value || !pool) {
      return false;
    }

    return (
      to.amount.value > fractionsToNum(pool?.y.amount, pool?.y.asset.decimals)
    );
  }
}

const getAssetsByToken = (pairAssetId?: string) =>
  pairAssetId ? getAssetsByPairAsset(pairAssetId) : pools$;

const initialValues: SwapFormModel = {
  from: {
    asset: {
      name: 'ERG',
      id: '0000000000000000000000000000000000000000000000000000000000000000',
      decimals: ERG_DECIMALS,
    },
  },
};

const fromToTo = (fromValue: TokenControlValue, pool: AmmPool): number => {
  const toAmount = pool.outputAmount(
    new AssetAmount(
      fromValue.asset!,
      parseUserInputToFractions(
        fromValue.amount?.value!,
        fromValue.asset?.decimals,
      ),
    ),
  );

  return fractionsToNum(toAmount.amount, toAmount.asset?.decimals);
};

const toToFrom = (
  toValue: TokenControlValue,
  pool: AmmPool,
): number | undefined => {
  const fromAmount = pool.inputAmount(
    new AssetAmount(
      toValue.asset!,
      parseUserInputToFractions(
        toValue.amount?.value!,
        toValue.asset?.decimals,
      ),
    ),
  );

  return fromAmount
    ? fractionsToNum(fromAmount.amount, fromAmount.asset?.decimals)
    : undefined;
};

const isFromFieldAssetChanged = (
  value: SwapFormModel,
  prevValue: SwapFormModel,
): boolean => value?.from?.asset?.id !== prevValue?.from?.asset?.id;

const isToAssetChanged = (
  value: SwapFormModel,
  prevValue: SwapFormModel,
): boolean =>
  !!value?.from?.asset &&
  !!value?.to?.asset &&
  value?.to?.asset?.id !== prevValue?.to?.asset?.id;

const getAvailablePools = (xId?: string, yId?: string): Observable<AmmPool[]> =>
  xId && yId ? getPoolByPair(xId, yId) : of([]);

const isFromAmountChangedWithEmptyPool = (
  value: SwapFormModel,
  prevValue: SwapFormModel,
): boolean => !value?.pool && value?.from?.amount !== prevValue?.from?.amount;

const isToAmountChangedWithEmptyPool = (
  value: SwapFormModel,
  prevValue: SwapFormModel,
): boolean => !value?.pool && value?.to?.amount !== prevValue?.to?.amount;

const isFromAmountChangedWithActivePool = (
  value: SwapFormModel,
  prevValue: SwapFormModel,
): boolean => !!value?.pool && value?.from?.amount !== prevValue?.from?.amount;

const isToAmountChangedWithActivePool = (
  value: SwapFormModel,
  prevValue: SwapFormModel,
): boolean => !!value?.pool && value?.to?.amount !== prevValue?.to?.amount;

const sortPoolByLpDesc = (poolA: AmmPool, poolB: AmmPool) =>
  fractionsToNum(poolB.lp.amount) - fractionsToNum(poolA.lp.amount);

export const Swap: FC = () => {
  const [form] = Form.useForm<SwapFormModel>();
  const [ergoAssets] = useObservable(assets$);
  const [toAssets, updateToAssets] = useObservableAction(getAssetsByToken);
  const [pools, updatePoolsByPair] = useObservableAction(getAvailablePools);
  const [balance] = useWalletBalance();
  const [{ minerFee }] = useSettings();
  const [changes, setChanges] = useState<any>();
  const [tokens, setTokens] = useState<any>();
  const swapStrategy = new SwapStrategy(balance, minerFee);
  const networks = [
    { name: 'ergo', token: 'erg', isDisabled: false },
    { name: 'cardano', token: 'ada', isDisabled: false },
  ];

  const arr1 = [
    {
      decimals: 9,
      id: '0000000000000000000000000000000000000000000000000000000000000000',
      name: 'ERG',
    },
    {
      decimals: 2,
      id: '03faf2cb329f2e90d6d23b58d91bbb6c046aa143261cc21f52fbe2824bfcbf04',
      name: 'SigUSD',
    },
  ];

  const arr2 = [
    {
      decimals: 9,
      id: '0000000000000000000000000000000000000000000000000000000000000000',
      name: 'VGC',
    },
  ];

  useEffect(() => {
    updateToAssets(initialValues.from?.asset?.id);
  }, [updateToAssets]);

  useEffect(() => {
    const { pool, to, from } = form.getFieldsValue();
    const newPool = pools?.slice().sort(sortPoolByLpDesc)[0];

    if (!pool || pool.id !== newPool?.id) {
      const fromAmount =
        !from?.amount && to?.amount && newPool
          ? {
              value: toToFrom(to, newPool),
              viewValue: toToFrom(to, newPool)?.toString(),
            }
          : from?.amount;
      const toAmount =
        from?.amount && newPool
          ? {
              value: fromToTo(from, newPool),
              viewValue: fromToTo(from, newPool).toString(),
            }
          : to?.amount;

      form.setFieldsValue({
        pool: newPool,
        from: { ...from, amount: fromAmount },
        to: { ...to, amount: toAmount },
      });
      setChanges({});
    }
  }, [pools, form]);

  const onValuesChange = (
    changes: SwapFormModel,
    value: SwapFormModel,
    prevValue: SwapFormModel,
  ) => {
    if (isFromFieldAssetChanged(value, prevValue)) {
      updateToAssets(value?.from?.asset?.id);
      form.setFieldsValue({ to: undefined, pool: undefined });
      updatePoolsByPair();
    }
    if (isToAssetChanged(value, prevValue)) {
      updatePoolsByPair(value?.from?.asset?.id!, value?.to?.asset?.id!);
    }
    if (isFromAmountChangedWithEmptyPool(value, prevValue)) {
      form.setFieldsValue({ to: undefined });
    }
    if (isToAmountChangedWithEmptyPool(value, prevValue)) {
      form.setFieldsValue({ from: { ...value.from, amount: undefined } });
    }
    if (isFromAmountChangedWithActivePool(value, prevValue)) {
      const toAmount = fromToTo(value.from!, value.pool!);
      form.setFieldsValue({
        to: {
          ...value.to,
          amount: { value: toAmount, viewValue: toAmount.toString() },
        },
      });
    }
    if (isToAmountChangedWithActivePool(value, prevValue)) {
      const fromAmount = toToFrom(value.to!, value.pool!);
      form.setFieldsValue({
        from: {
          ...value.from,
          amount: { value: fromAmount, viewValue: fromAmount?.toString() },
        },
      });
    }
    setChanges({});
  };

  const onSetNetwork = (key: string) => {
    if (key == 'cardano') {
      setTokens(arr1);
    } else {
      setTokens(ergoAssets);
    }
  };

  return (
    <FormPageWrapper width={480}>
      <ActionForm
        form={form}
        strategy={swapStrategy}
        onValuesChange={onValuesChange}
        initialValues={initialValues}
      >
        <Flex flexDirection="col">
          <Flex flexDirection="row" alignItems="center">
            <Flex.Item flex={1}>
              <Typography.Title level={4}>Swap</Typography.Title>
            </Flex.Item>
          </Flex>

          <NetworkDropdown networks={networks} onSetNetwork={onSetNetwork} />
          <Flex.Item marginBottom={1}>
            <TokenControlFormItem assets={arr2} name="from" label="From" />
          </Flex.Item>
          <Flex.Item marginBottom={4}>
            <TokenControlFormItem assets={tokens} name="to" label="To" />
          </Flex.Item>
        </Flex>
      </ActionForm>
    </FormPageWrapper>
  );
};
