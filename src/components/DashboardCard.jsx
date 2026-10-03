import React, { useContext } from 'react';
import { DashboardContext } from '../context/DashboardContext';
import './DashboardCard.css';

const DashboardCard = ({ title, children, removable = true }) => {
  const { removeCard } = useContext(DashboardContext);

  return (
    <div className="dashboard-card">
      <div className="card-header">
        <h3>{title}</h3>
        {removable && (
          <button 
            className="remove-btn"
            onClick={() => removeCard(title)}
            aria-label="Remove card"
          >
            ×
          </button>
        )}
      </div>
      <div className="card-content">
        {children}
      </div>
    </div>
  );
};

export default DashboardCard;
