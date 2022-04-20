import './Header.less';

import React from 'react';

import { BurgerMenu } from './BurgerMenu/BurgerMenu';

export const Header: React.FC = () => {
  return (
    <header className="header">
      <div className="header__wrapper">
        <div className="header__options">
          <BurgerMenu />
        </div>
      </div>
    </header>
  );
};
