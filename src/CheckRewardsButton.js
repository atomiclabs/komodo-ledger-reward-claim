import React from 'react';
import getKomodoRewards from 'get-komodo-rewards';
import ledger from './lib/ledger';
import accountDiscovery from './lib/account-discovery';
import blockchain from './lib/blockchain';
import updateActionState from './lib/update-action-state';
import {SERVICE_FEE_PERCENT, TX_FEE} from './constants';
import ActionListModal from './ActionListModal';

class CheckRewardsButton extends React.Component {
  state = this.initialState;

  get initialState() {
    return {
      isCheckingRewards: false,
      error: false,
      actions: {
        connect: {
          icon: 'fab fa-usb',
          description: <div>Connect and unlock your Ledger, then open the Komodo app on your device.</div>,
          state: null
        },
        approve: {
          icon: 'fas fa-microchip',
          description: <div>Approve all public key export requests on your device. <strong>There will be multiple requests</strong>.</div>,
          state: null
        }
      }
    };
  }

  resetState = () => this.setState(this.initialState);

  calculateRewardData = ({accounts, tiptime}) => accounts.map(account => {
    account.balance = account.utxos.reduce((balance, utxo) => balance + utxo.satoshis, 0);
    account.rewards = account.utxos.reduce((rewards, utxo) => rewards + getKomodoRewards({tiptime, ...utxo}), 0);
    account.serviceFee = Math.floor((account.rewards / 100) * SERVICE_FEE_PERCENT);
    account.claimableAmount = account.rewards - account.serviceFee - TX_FEE;

    return account;
  });

  scanAddresses = async () => {
    this.props.handleRewardData({
      accounts: [],
      tiptime: []
    });

    this.setState({
      ...this.initialState,
      isCheckingRewards: true,
    });

    let currentAction;
    try {
      currentAction = 'connect';
      updateActionState(this, currentAction, 'loading');
      const ledgerIsAvailable = await ledger.isAvailable();
      if (!ledgerIsAvailable) {
        throw new Error('Ledger device is unavailable!');
      }
      updateActionState(this, currentAction, true);

      currentAction = 'approve';
      updateActionState(this, currentAction, 'loading');
      let [accounts, tiptime] = await Promise.all([
        accountDiscovery(),
        blockchain.getTipTime()
      ]);

      accounts = this.calculateRewardData({accounts, tiptime});
      if (accounts.length === 0) {
        throw new Error('No account balances found.');
      }
      updateActionState(this, currentAction, true);

      this.props.handleRewardData({
        accounts,
        tiptime
      });

      this.setState({...this.initialState});
    } catch (error) {
      updateActionState(this, currentAction, false);
      this.setState({error: error.message});
    }
  };

  render() {
    const {isCheckingRewards, actions, error} = this.state;

    return (
      <>
        <button className="button is-primary" onClick={this.scanAddresses}>
          {this.props.children}
        </button>
        <ActionListModal
          title="Scanning Blockchain for Rewards"
          actions={actions}
          error={error}
          handleClose={this.resetState}
          show={isCheckingRewards}>
          <p>
            Exporting public keys from your Ledger device, scanning the blockchain for funds, and calculating any claimable rewards. Please approve any public key export requests on your device.
          </p>
        </ActionListModal>
      </>
    );
  }

}

export default CheckRewardsButton;
