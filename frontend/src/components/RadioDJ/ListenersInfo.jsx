import React from 'react';
import Icon from '../Icon/Icon';

function ListenersInfo({ count }) {
  return (
    <div className="listeners-info">
      <Icon name="users" type="emoji" size={20} />
      <span className="count">{count}</span>
      <span className="label">слушателей</span>
    </div>
  );
}

export default ListenersInfo;